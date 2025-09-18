  import { Request, Response } from "express";
  import { PrismaClient } from "generated/prisma";
import { ObjectId } from 'mongodb';
import { sendExamMail, sendExamResultEmail } from "services/email.service";
import { generatePresignedViewUrl, uploadPrivateFileToS3 } from "utils/s3.utils";
  const prisma = new PrismaClient();

  export const getAllExams = async (req: Request, res: Response) => {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        course: true, 
        questions: true, 
      },
    });
    res.json(exams);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createExam = async (req: Request, res: Response) => {
    try {
        const { title, description, durationMins, totalMarks, passingMarks, isFinalExam, courseId } = req.body;
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(401).json({ error: "Unauthorized: User email not found." });
        }
        if (!title || !durationMins || !totalMarks || !passingMarks || !courseId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }
        const exam = await prisma.exam.create({
            data: { title, description, durationMins, totalMarks, passingMarks, isFinalExam, courseId },
            include: { course: true }
        });
        const enrollments = await prisma.courseEnrollment.findMany({
            where: { courseId: courseId },
            include: { user: { select: { email: true } } }
        });
        for (const enrollment of enrollments) {
            if (enrollment.user && enrollment.user.email) {
                sendExamMail(exam, enrollment.user.email);
            }
        }
        res.status(201).json(exam);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

  export const getExamsByCourse = async (req: Request, res: Response) => {
    try {
      const { courseId } = req.params;
      
      if (!courseId) {
        return res.status(400).json({ error: "Course ID is required" });
      }

      const exams = await prisma.exam.findMany({
        where: { courseId },
        include: { 
          questions: { 
            include: { options: true } 
          }, 
          attempts: {
            where: { userId: (req as any).user.id },
            orderBy: { startedAt: 'desc' }
          },
          course: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      res.json(exams);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

export const getExamById = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;

  
    if (!examId || !ObjectId.isValid(examId)) {
      return res.status(400).json({ error: "Valid Exam ID is required" });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { 
        questions: { 
          include: { options: true },
          orderBy: { id: "asc" }
        }, 
        attempts: {
          where: { userId: (req as any).user.id },
          orderBy: { startedAt: "desc" }
        },
        course: { select: { title: true } }
      },
    });

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    res.json(exam);
  } catch (err: any) {
    console.error("Error fetching exam:", err);
    res.status(500).json({ error: err.message });
  }
};

  export const updateExam = async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;
      const { title, description, durationMins, totalMarks, passingMarks, isFinalExam } = req.body;
      
      if (!examId) {
        return res.status(400).json({ error: "Exam ID is required" });
      }

      const existingExam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!existingExam) {
        return res.status(404).json({ error: "Exam not found" });
      }

      const exam = await prisma.exam.update({
        where: { id: examId },
        data: { title, description, durationMins, totalMarks, passingMarks, isFinalExam },
        include: { course: true }
      });
      
      res.json(exam);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

 export const deleteExam = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    if (!examId) return res.status(400).json({ error: "Exam ID is required" });

    const attemptCount = await prisma.examAttempt.count({ where: { examId } });
    if (attemptCount > 0) return res.status(400).json({ error: "Cannot delete exam with existing attempts" });

    const questions = await prisma.examQuestion.findMany({ where: { examId } });
    for (const question of questions) {
      await prisma.examOption.deleteMany({ where: { questionId: question.id } });
    }

    await prisma.examQuestion.deleteMany({ where: { examId } });
    await prisma.exam.delete({ where: { id: examId } });

    res.json({ message: "Exam deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const startExam = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = (req as any).user.id;

    if (!examId) {
      return res.status(400).json({ error: "Exam ID is required" });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true }
    });

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    if (exam.questions.length === 0) {
      return res.status(400).json({ error: "Cannot start exam without questions" });
    }

   
    const completedAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId,
        userId,
        completedAt: { not: null }
      }
    });

    if (completedAttempt) {
      return res.status(400).json({
        error: "You have already attempted this exam",
        attemptId: completedAttempt.id,
      });
    }

    
    const incompleteAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId,
        userId,
        completedAt: null
      }
    });

    if (incompleteAttempt) {
      const now = new Date();
      const elapsedMs = now.getTime() - incompleteAttempt.startedAt.getTime();
      const elapsedMins = Math.floor(elapsedMs / (1000 * 60));
      const remainingMins = Math.max(0, exam.durationMins - elapsedMins);

      if (remainingMins <= 0) {
        await prisma.examAttempt.update({
          where: { id: incompleteAttempt.id },
          data: {
            completedAt: new Date(),
            score: 0
          }
        });
        return res.status(400).json({
          error: "Your exam time has expired",
          expired: true
        });
      }

      return res.status(400).json({
        error: "You already have an incomplete attempt for this exam",
        attemptId: incompleteAttempt.id,
        expiresAt: new Date(now.getTime() + remainingMins * 60 * 1000),
        answers: incompleteAttempt.answers || {}
      });
    }

    
    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        userId,
        score: 0,
        answers: {},
        startedAt: new Date()
      },
      include: { exam: { select: { title: true, durationMins: true } } }
    });

    res.status(201).json({
      ...attempt,
      expiresAt: new Date(Date.now() + exam.durationMins * 60 * 1000)
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

 export const submitExam = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { answers } = req.body;

    if (!attemptId || !answers) {
      return res.status(400).json({ error: "Attempt ID and answers are required" });
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: {
              include: { options: true }
            }
          }
        }
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    if (attempt.completedAt) {
      return res.status(400).json({ error: "This attempt has already been submitted" });
    }

    const timeLimit = attempt.exam.durationMins * 60 * 1000;
    const timeElapsed = Date.now() - attempt.startedAt.getTime();
    if (timeElapsed > timeLimit) {
      return res.status(400).json({ error: "Time limit exceeded for this exam" });
    }

    let autoScore = 0;
    let hasSubjectiveQuestions = false;
    const questionResponses = [];

    // Process each question
    for (const question of attempt.exam.questions) {
      const userAnswer = answers[question.id];
      
      if (question.questionType === 'MCQ') {
        const isCorrect = userAnswer && userAnswer === question.correctOptionId;
        const marksAwarded = isCorrect ? question.maxMarks : 0;
        autoScore += marksAwarded;
        
        questionResponses.push({
          questionId: question.id,
          answer: userAnswer || null,
          marksAwarded,
          isCorrect,
          evaluationStatus: 'AUTO_GRADED'
        });
      } else if (question.questionType === 'SUBJECTIVE') {
        hasSubjectiveQuestions = true;
        
        questionResponses.push({
          questionId: question.id,
          answer: userAnswer || '',
          marksAwarded: null,
          isCorrect: null,
          evaluationStatus: 'PENDING_EVALUATION'
        });
      }
    }

    const evaluationStatus = hasSubjectiveQuestions ? 'PENDING_EVALUATION' : 'COMPLETED';

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        answers,
        score: autoScore,
        completedAt: new Date(),
        isPassed: evaluationStatus === 'COMPLETED' ? autoScore >= attempt.exam.passingMarks : false,
        evaluationStatus,
        questionResponses: JSON.stringify(questionResponses)
      },
      include: {
        exam: {
          select: {
            title: true,
            totalMarks: true,
            passingMarks: true
          }
        }
      }
    });

    res.json({
      ...updated,
      autoGradedScore: autoScore,
      hasSubjectiveQuestions,
      message: hasSubjectiveQuestions 
        ? "Exam submitted! Awaiting manual evaluation of subjective answers."
        : "Exam completed and graded!"
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

  export const getAttemptsByUser = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { examId } = req.query;
      
      const whereClause: any = { userId };
      if (examId) whereClause.examId = examId;

      const attempts = await prisma.examAttempt.findMany({
        where: whereClause,
        include: { 
          exam: {
            select: {
              title: true,
              totalMarks: true,
              passingMarks: true,
              durationMins: true,
              course: { select: { title: true } }
            }
          }
        },
        orderBy: { startedAt: 'desc' }
      });

      const enhancedAttempts = attempts.map((attempt: { exam: { totalMarks: number; }; score: number; completedAt: { getTime: () => number; }; startedAt: { getTime: () => number; }; }) => ({
        ...attempt,
        percentage: attempt.exam.totalMarks > 0 
          ? Math.round((attempt.score / attempt.exam.totalMarks) * 10000) / 100
          : 0,
        duration: attempt.completedAt 
          ? Math.round((attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000 / 60) 
          : null
      }));
      
      res.json(enhancedAttempts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

 export const getExamStats = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;

    if (!examId || !/^[0-9a-fA-F]{24}$/.test(examId)) {
      return res.status(400).json({ error: "Valid Exam ID is required" });
    }

    const examObjectId = new ObjectId(examId);

    const stats = await prisma.examAttempt.groupBy({
      by: ['isPassed'],
      where: { examId: examObjectId, completedAt: { not: null } },
      _count: { id: true },
      _avg: { score: true }
    });

    const totalAttempts = await prisma.examAttempt.count({
      where: { examId: examObjectId, completedAt: { not: null } }
    });

    const passedCount = stats.find((s: { isPassed: any; }) => s.isPassed)?._count.id || 0;
    const failedCount = stats.find((s: { isPassed: any; }) => !s.isPassed)?._count.id || 0;
    const averageScore = stats.length
      ? stats.reduce((acc: any, curr: { _avg: { score: any; }; }) => acc + (curr._avg.score || 0), 0) / stats.length
      : 0;

    res.json({
      totalAttempts,
      passedCount,
      failedCount,
      passRate: totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0,
      averageScore: Math.round(averageScore * 100) / 100
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { text, questionType = 'MCQ', options, maxMarks = 1, markingScheme } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Question text is required" });
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    if (questionType === 'MCQ') {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          error: "MCQ questions require at least 2 options"
        });
      }

      const correctOption = options.find(opt => opt.isCorrect);
      if (!correctOption) {
        return res.status(400).json({
          error: "One option must be marked as correct for MCQ"
        });
      }

      const tempObjectId = new ObjectId().toString();

      const question = await prisma.examQuestion.create({
        data: {
          examId,
          text,
          questionType: 'MCQ',
          maxMarks,
          correctOptionId: tempObjectId
        }
      });

      const createdOptions = await Promise.all(
        options.map(async (option: any) => {
          return await prisma.examOption.create({
            data: {
              questionId: question.id,
              text: option.text
            }
          });
        })
      );

      const correctOptionIndex = options.findIndex(opt => opt.isCorrect);
      const correctOptionId = createdOptions[correctOptionIndex].id;

      const updatedQuestion = await prisma.examQuestion.update({
        where: { id: question.id },
        data: { correctOptionId },
        include: { options: true }
      });

      res.status(201).json(updatedQuestion);

    } else if (questionType === 'SUBJECTIVE') {
      const question = await prisma.examQuestion.create({
        data: {
          examId,
          text,
          questionType: 'SUBJECTIVE',
          maxMarks: maxMarks || 5,
          markingScheme,
          correctOptionId: null
        }
      });

      res.status(201).json(question);
    } else {
      return res.status(400).json({
        error: "Invalid question type. Must be 'MCQ' or 'SUBJECTIVE'"
      });
    }

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

  export const getQuestionsByExam = async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;

      const questions = await prisma.examQuestion.findMany({
        where: { examId },
        include: { options: true },
        orderBy: { id: 'asc' }
      });

      res.json(questions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  export const updateQuestion = async (req: Request, res: Response) => {
    try {
      const { questionId } = req.params;
      const { text, options } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Question text is required" });
      }

      const existingQuestion = await prisma.examQuestion.findUnique({
        where: { id: questionId },
        include: { options: true }
      });

      if (!existingQuestion) {
        return res.status(404).json({ error: "Question not found" });
      }

      await prisma.examQuestion.update({
        where: { id: questionId },
        data: { text }
      });

      if (options && Array.isArray(options)) {
        await prisma.examOption.deleteMany({
          where: { questionId }
        });

        const createdOptions = await Promise.all(
          options.map(async (option: any) => {
            return await prisma.examOption.create({
              data: {
                questionId,
                text: option.text
              }
            });
          })
        );

        const correctOptionIndex = options.findIndex(opt => opt.isCorrect);
        if (correctOptionIndex >= 0) {
          const correctOptionId = createdOptions[correctOptionIndex].id;
          await prisma.examQuestion.update({
            where: { id: questionId },
            data: { correctOptionId }
          });
        }
      }

      const updatedQuestion = await prisma.examQuestion.findUnique({
        where: { id: questionId },
        include: { options: true }
      });

      res.json(updatedQuestion);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;

    const attempts = await prisma.examAttempt.findMany();


    const hasAttempt = attempts.some((attempt: { answers: any[]; }) =>
      Array.isArray(attempt.answers) &&
      attempt.answers.some((a: any) => a.questionId === questionId)
    );

    if (hasAttempt) {
      return res.status(400).json({
        error: "Cannot delete question that has been answered in exam attempts"
      });
    }

    await prisma.examOption.deleteMany({
      where: { questionId }
    });

    await prisma.examQuestion.delete({
      where: { id: questionId }
    });

    res.json({ message: "Question deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

 export const bulkCreateQuestions = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "Questions array is required" });
    }

    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const createdQuestions = [];

    for (const qData of questions) {
      const { text, marks, questionType, options, markingScheme } = qData;

      if (!text || !questionType) {
        continue;
      }

      if (questionType === "MCQ") {
        if (!options || !Array.isArray(options) || options.length < 2 || !options.some(opt => opt.isCorrect)) {
          continue;
        }

        const tempObjectId = new ObjectId().toString();
        const question = await prisma.examQuestion.create({
          data: {
            examId,
            text,
            questionType,
            maxMarks: marks || 1,
            correctOptionId: tempObjectId,
          },
        });

        const createdOptions = await Promise.all(
          options.map((option: any) =>
            prisma.examOption.create({
              data: {
                questionId: question.id,
                text: option.text,
              },
            })
          )
        );

        const correctOptionIndex = options.findIndex(opt => opt.isCorrect);
        const correctOptionId = createdOptions[correctOptionIndex].id;

        const updatedQuestion = await prisma.examQuestion.update({
          where: { id: question.id },
          data: { correctOptionId },
          include: { options: true },
        });

        createdQuestions.push(updatedQuestion);

      } else if (questionType === "SUBJECTIVE") {
        const question = await prisma.examQuestion.create({
          data: {
            examId,
            text,
            questionType,
            maxMarks: marks || 5,
            markingScheme: markingScheme || "",
            options: { create: [] }
          },
           include: { options: true }
        });
        createdQuestions.push(question);
      }
    }

    res.status(201).json({
      message: `Created ${createdQuestions.length} questions`,
      questions: createdQuestions,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

export const getExamAttemptStatus = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = (req as any).user.id;

    if (!examId) {
      return res.status(400).json({ error: "Exam ID is required" });
    }

    const lastAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId,
        userId,
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        id: true,
        score: true,
        startedAt: true,
        completedAt: true,
        isPassed: true,
      },
    });

  
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!lastAttempt) {
      return res.status(200).json({
        hasAttempted: false,
        status: "not_started",
        canRetake: true,
      });
    }

    let responseStatus = "in_progress";
    if (lastAttempt.completedAt) {
      responseStatus = "completed";
    }


    const attemptsMade = await prisma.examAttempt.count({
      where: { examId, userId },
    });
    const canRetake = attemptsMade < (exam?.maxAttempts || 1);

    return res.status(200).json({
      hasAttempted: true,
      status: responseStatus,
      canRetake,
      lastAttemptScore: lastAttempt.score,
      lastAttemptDate: lastAttempt.startedAt,
      isPassed: lastAttempt.isPassed,
    });
  } catch (err: any) {
    console.error("Error in getExamAttemptStatus:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const getPassedExamsUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Exam ID is required" });
    }

    const passedUsers = await prisma.examAttempt.findMany({
      where: {
        examId: id,
        isPassed: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json(passedUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getFailedUsersForExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Exam ID is required" });
    }

    const failedUsers = await prisma.examAttempt.findMany({
      where: {
        examId: id,
        isPassed: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json(failedUsers);
  } catch (error) {
    console.error('Error fetching failed users:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const evaluateSubjectiveAnswers = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { evaluations } = req.body; // [{questionId, marksAwarded, feedback}]

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { include: { questions: true } } }
    });

    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    const questionResponses = JSON.parse(attempt.questionResponses || '[]');
    let totalScore = 0;

    // Update evaluations
    for (const evaluation of evaluations) {
      const responseIndex = questionResponses.findIndex((qr: any) => qr.questionId === evaluation.questionId);
      if (responseIndex !== -1) {
        questionResponses[responseIndex] = {
          ...questionResponses[responseIndex],
          marksAwarded: evaluation.marksAwarded,
          feedback: evaluation.feedback,
          evaluationStatus: 'EVALUATED'
        };
      }
    }

    // Recalculate total score
    questionResponses.forEach((qr: any) => {
      if (qr.marksAwarded !== null) {
        totalScore += qr.marksAwarded;
      }
    });

    const allEvaluated = questionResponses.every((qr: any) => qr.evaluationStatus !== 'PENDING_EVALUATION');

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        questionResponses: JSON.stringify(questionResponses),
        evaluationStatus: allEvaluated ? 'COMPLETED' : 'PENDING_EVALUATION',
        isPassed: allEvaluated ? totalScore >= attempt.exam.passingMarks : false,
        evaluatedBy: req.user?.id,
        evaluatedAt: allEvaluated ? new Date() : null
      }
    });

    res.json({ success: true, totalScore, isComplete: allEvaluated });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getPendingEvaluations = async (req: Request, res: Response) => {
  try {
    const pendingAttempts = await prisma.examAttempt.findMany({
      where: { evaluationStatus: 'PENDING_EVALUATION' },
      include: {
        exam: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { completedAt: 'asc' }
    });

    res.json({ pendingAttempts, count: pendingAttempts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};


export const uploadExamRecording = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const fileBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;
    const key = `exam-recordings/${attemptId}-${Date.now()}.webm`;
    
    await uploadPrivateFileToS3(fileBuffer, mimetype, key);

    const S3_PUBLIC_URL = `https://${process.env.AWS_PRIVATE_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    const staticVideoUrl = `${S3_PUBLIC_URL}/${key}`;

    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { 
        videoRecordingKey: key,
        videoUrl: staticVideoUrl
      },
    });

    const presignedUrl = await generatePresignedViewUrl(key);

    return res.json({
      message: "Recording uploaded successfully",
      key: key,
      videoUrl: staticVideoUrl,
      presignedUrl: presignedUrl,
      attempt: updatedAttempt,
    });
    
  } catch (error) {
    console.error("Error uploading exam recording:", error);
    return res.status(500).json({ error: "Failed to upload recording" });
  }
};

export const getMyExamAttempts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const attempts = await prisma.examAttempt.findMany({
      where: { userId },
      select: {
        id: true,
        examId: true,
        score: true,
        completedAt: true,
        isPassed: true,
      },
    });

    res.json(attempts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const sendBulkExamResults = async (req: Request, res: Response) => {
  try {
    const pendingAttempts = await prisma.examAttempt.findMany({
      where: {
        evaluationStatus: { in: ["PENDING", "PENDING_EVALUATION"] },
      },
      include: { exam: true, user: true },
    });

    if (pendingAttempts.length === 0) {
      return res.status(200).json({ message: "No pending exam results to send." });
    }

    for (const attempt of pendingAttempts) {
      const score = attempt.score ?? 0;

      // Send email
      await sendExamResultEmail(
        attempt.user.email,
        attempt.user.name,
        attempt.exam.title,
        score,
        attempt.exam.totalMarks,
        attempt.isPassed
      );

      // Update attempt
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          score: score,
          isPassed: attempt.isPassed,
          evaluationStatus: "COMPLETED", 
        },
      });
    }

    return res.status(200).json({ message: "Bulk exam results sent successfully." });
  } catch (error) {
    console.error("Error sending bulk exam results:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getExamAttemptById = async (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        user: true,
      },
    });

    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    res.status(200).json(attempt);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch attempt", error: err.message });
  }
};


export const getAllExamScores = async (req: Request, res: Response) => {
  try {
    const scores = await prisma.examAttempt.findMany({
      select: {
        id: true,
        examId: true,
        userId: true,
        score: true,
        isPassed: true,
        completedAt: true,
        exam: {
          select: { id: true, title: true, totalMarks: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    if (!scores.length) {
      return res.status(404).json({ message: "No exam scores found" });
    }

    res.json({ total: scores.length, scores });
  } catch (error: any) {
    console.error("Error fetching all exam scores:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};


export const getExamRecordingPresignedUrl = async (req: Request, res: Response) => {
  try {
    const { key } = req.query;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: "Missing or invalid 'key' query parameter" });
    }

    const presignedUrl = await generatePresignedViewUrl(key);

    return res.json({ presignedUrl });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return res.status(500).json({ error: "Failed to generate presigned URL" });
  }
};

