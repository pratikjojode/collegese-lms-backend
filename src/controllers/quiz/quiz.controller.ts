import { Request, Response } from 'express';
import prisma from '../../config/db';
import { QuestionType, AnswerRevealPolicy, Role, NotificationType } from '../../generated/prisma';
import { NotificationService } from '../../services/notification.service';
import { sendQuizCreatedEmail } from 'services/email.service';


export const createQuizController = async (req: Request, res: Response) => {
    try {
        const { title, description, courseId, timeLimit, answerRevealPolicy } = req.body;
        const user = (req as any).user;
        if (!title || !courseId) {
            return res.status(400).json({ success: false, message: 'Title and Course ID are required.' });
        }
        const newQuiz = await prisma.quiz.create({
            data: {
                title,
                description,
                timeLimit: timeLimit ? parseInt(timeLimit) : undefined,
                answerRevealPolicy,
                course: { connect: { id: courseId } },
                createdBy: { connect: { id: user.id } },
                status: 'DRAFT',
            },
            include: { createdBy: { select: { name: true, email: true } } },
        });

       
        const enrolledStudents = await prisma.courseEnrollment.findMany({
            where: { courseId: courseId },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
            },
        });

       
        const emailPromises = enrolledStudents.map(enrollment => {
            if (enrollment.user && enrollment.user.email) {
                return sendQuizCreatedEmail(
                    enrollment.user.email,
                    enrollment.user.name || 'Student',
                    newQuiz
                );
            }
            return Promise.resolve(); 
        });

        await Promise.all(emailPromises);

        res.status(201).json({ success: true, message: 'Quiz created successfully.', quiz: newQuiz });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to create quiz.' });
    }
};

export const addQuestionToQuizController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const { text, type, marks, options, correctAnswer, tags } = req.body;
        const questionData: any = {
            text,
            type: type || QuestionType.MCQ,
            marks: marks || 1,
            options: {
                create: options.map((o: any) => ({
                    text: o.text,
                    isCorrect: o.isCorrect
                }))
            },
            correctAnswer,
            tags: tags || [],
            quiz: { connect: { id: quizId } },
        };
        const newQuestion = await prisma.question.create({ data: questionData });
        res.status(201).json({ success: true, message: 'Question added successfully.', question: newQuestion });
    } catch (error) {
        console.error('Error adding question:', error);
        res.status(500).json({ success: false, message: 'Failed to add question.' });
    }
};

export const publishQuizController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const quiz = await prisma.quiz.update({
            where: { id: quizId, status: 'DRAFT' },
            data: { status: 'PUBLISHED' },
            include: {
                course: true
            }
        });
        if (quiz.courseId) {
            await NotificationService.notifyAllCourseStakeholders(
                quiz.courseId,
                'QUIZ_PUBLISHED',
                'New Quiz Available',
                `A new quiz "${quiz.title}" has been published in the course.`,
                { quizId: quiz.id, courseId: quiz.courseId },
                {
                    notifyStudents: true,      
                    notifyTeachers: true,     
                    notifyAssistants: true,     
                    notifyAdmins: false,        
                    notifySuperAdmins: false,   
                }
            );
        }

        res.status(200).json({ success: true, message: 'Quiz published successfully.', quiz });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to publish quiz. It may already be published or not exist.' });
    }
};

export const updateQuizController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const { title, description, courseId, timeLimit } = req.body;
        const updatedQuiz = await prisma.quiz.update({
            where: { id: quizId },
            data: {
                title,
                description,
                courseId,
                timeLimit: timeLimit ? parseInt(timeLimit) : undefined,
            },
            include: { createdBy: { select: { name: true, email: true } } },
        });
        res.status(200).json({ success: true, message: 'Quiz updated successfully.', quiz: updatedQuiz });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update quiz.' });
    }
};

export const deleteQuizController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        await prisma.quiz.update({
            where: { id: quizId },
            data: { status: 'archived', isLatest: false },
        });

        res.status(200).json({ success: true, message: 'Quiz soft-deleted successfully.' });
    } catch (error) {
        console.error('Error deleting quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to delete quiz.' });
    }
};

export const getQuizSubmissionsController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const submissions = await prisma.quizSubmission.findMany({
            where: { quizId },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        res.status(200).json({ success: true, submissions });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch submissions.' });
    }
};

export const gradeSubmissionController = async (req: Request, res: Response) => {
    try {
        const { submissionId } = req.params;
        const { gradedResponses } = req.body;
        await prisma.$transaction(
            gradedResponses.map((res: { responseId: string; marksAwarded: number }) =>
                prisma.quizResponse.update({
                    where: { id: res.responseId },
                    data: { marksAwarded: res.marksAwarded },
                })
            )
        );
        const submissionResponses = await prisma.quizResponse.findMany({
            where: { submissionId },
            include: { question: true },
        });

        const totalScore = submissionResponses.reduce((acc: any, res: { isCorrect: any; question: { marks: any; }; marksAwarded: any; }) => {
            if (res.isCorrect) {
                return acc + res.question.marks;
            }
            if (res.marksAwarded) {
                return acc + res.marksAwarded;
            }
            return acc;
        }, 0);

        const updatedSubmission = await prisma.quizSubmission.update({
            where: { id: submissionId },
            data: {
                score: totalScore,
                status: 'COMPLETED',
            },
            include: {
                quiz: true,
                user: true
            }
        });
        await NotificationService.createNotification({
            type: 'QUIZ_GRADED',
            title: 'Quiz Graded',
            message: `Your submission for "${updatedSubmission.quiz.title}" has been graded. Score: ${totalScore}`,
            recipientId: updatedSubmission.userId,
            metadata: {
                quizId: updatedSubmission.quizId,
                submissionId: updatedSubmission.id,
                score: totalScore
            }
        });
        res.status(200).json({ success: true, message: 'Submission graded successfully.', submission: updatedSubmission });
    } catch (error) {
        console.error('Error grading submission:', error);
        res.status(500).json({ success: false, message: 'Failed to grade submission.' });
    }
};

export const getAvailableQuizzesController = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const enrollments = await prisma.courseEnrollment.findMany({
            where: { userId },
            select: { courseId: true },
        });
        const courseIds = enrollments.map(e => e.courseId).filter((id): id is string => !!id);

        const quizzes = await prisma.quiz.findMany({
            where: {
                courseId: { in: courseIds },
                status: 'PUBLISHED',
                isLatest: true,
            },
            select: { id: true, title: true, description: true, timeLimit: true },
        });
        res.status(200).json({ success: true, quizzes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch quizzes.' });
    }
};

export const startQuizAttemptController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const userId = (req as any).user.id;
        const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { courseId: true, timeLimit: true } });
        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });
        if (!quiz.courseId) return res.status(400).json({ success: false, message: 'Quiz is not associated with a course.' });

        const enrollment = await prisma.courseEnrollment.findUnique({ where: { userId_courseId: { userId, courseId: quiz.courseId } } });
        if (!enrollment) return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });
        const existingSubmission = await prisma.quizSubmission.findUnique({ where: { userId_quizId: { userId, quizId } } });
        if (existingSubmission) return res.status(400).json({ success: false, message: 'You have already attempted this quiz.' });

        const newSubmission = await prisma.quizSubmission.create({
            data: {
                user: { connect: { id: userId } },
                quiz: { connect: { id: quizId } },
                status: 'IN_PROGRESS',
            },
        });
        res.status(201).json({ success: true, message: 'Quiz started.', submissionId: newSubmission.id, timeLimit: quiz.timeLimit });
    } catch (error) {
        console.error('Error starting quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to start quiz.' });
    }
};

export const getQuizAttemptQuestionsController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const questions = await prisma.question.findMany({
            where: { quizId },
            select: {
                id: true,
                text: true,
                type: true,
                marks: true,
                options: {
                    select: {
                        id: true,
                        text: true
                    }
                },
            },
        });

        res.status(200).json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch quiz questions.' });
    }
};

export const submitQuizAttemptController = async (req: Request, res: Response) => {
    try {
        const { submissionId } = req.params;
        const { answers } = req.body;
        const userId = (req as any).user.id;
        const submission = await prisma.quizSubmission.findFirst({
            where: { id: submissionId, userId, status: 'IN_PROGRESS' },
            include: { quiz: { include: { questions: { include: { options: true } } } } },
        });
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Active submission not found.' });
        }
        let score = 0;
        const responsesToCreate = [];
        for (const question of submission.quiz.questions) {
            const userAnswer = answers.find((a: any) => a.questionId === question.id);
            if (!userAnswer || !userAnswer.selectedOptionId) continue;
            const correctOption = question.options.find((opt: { isCorrect: any; }) => opt.isCorrect);
            const isCorrect = correctOption?.id === userAnswer.selectedOptionId;
            if (isCorrect) {
                score += question.marks;
            }
            responsesToCreate.push({
                submissionId,
                questionId: question.id,
                selectedOptionId: userAnswer.selectedOptionId,
                isCorrect,
                marksAwarded: isCorrect ? question.marks : 0,
            });
        }
        await prisma.quizResponse.createMany({ data: responsesToCreate });
        const updatedSubmission = await prisma.quizSubmission.update({
            where: { id: submissionId },
            data: { status: 'COMPLETED', score, endTime: new Date() },
            include: {
                quiz: {
                    include: {
                        createdBy: true,
                        questions: {
                            where: { type: 'SUBJECTIVE' }
                        }
                    }
                }
            }
        });
        if (updatedSubmission.quiz.questions.length > 0 && updatedSubmission.quiz.courseId) {
            await NotificationService.notifyAllCourseStakeholders(
                updatedSubmission.quiz.courseId,
                NotificationType.QUIZ_SUBMITTED,
                'Quiz Submission Needs Grading',
                `A submission for "${updatedSubmission.quiz.title}" needs manual grading for subjective questions.`,
                {
                    quizId: updatedSubmission.quiz.id,
                    submissionId: updatedSubmission.id,
                    courseId: updatedSubmission.quiz.courseId,
                    studentId: updatedSubmission.userId
                },
                {
                    notifyStudents: false,      
                    notifyTeachers: true,      
                    notifyAssistants: true,    
                    notifyAdmins: false,        
                    notifySuperAdmins: false,   
                }
            );
        } else if (updatedSubmission.quiz.courseId) {
            await NotificationService.notifyAllCourseStakeholders(
                updatedSubmission.quiz.courseId,
                NotificationType.QUIZ_SUBMITTED,
                'Quiz Submitted',
                `A student has completed the quiz "${updatedSubmission.quiz.title}".`,
                {
                    quizId: updatedSubmission.quiz.id,
                    submissionId: updatedSubmission.id,
                    courseId: updatedSubmission.quiz.courseId,
                    studentId: updatedSubmission.userId
                },
                {
                    notifyStudents: false,      
                    notifyTeachers: true,       
                    notifyAssistants: true,     
                    notifyAdmins: false,        
                    notifySuperAdmins: false,  
                }
            );
        }

        res.status(200).json({ success: true, message: 'Quiz submitted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit quiz.' });
    }
};


export const getMySubmissionResultController = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const userId = (req as any).user.id;
    
    const submission = await prisma.quizSubmission.findFirst({
      where: { id: submissionId, userId },
      include: {
        quiz: { 
          select: { 
            title: true, 
            answerRevealPolicy: true,
            questions: {
              select: {
                marks: true
              }
            }
          } 
        },
        responses: { 
          include: { 
            question: { include: { options: true } }, 
            selectedOption: { select: { text: true } } 
          } 
        },
      },
    });
    
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }
    const totalMarks = submission.quiz.questions.reduce(
      (sum: number, question: { marks: number }) => sum + question.marks, 0
    );
    
    const result: any = {
      quizTitle: submission.quiz.title,
      totalMarks: totalMarks,
      status: submission.status,
      score: submission.score,
      responses: null,
    };
    
    if (submission.quiz.answerRevealPolicy === AnswerRevealPolicy.AFTER_DEADLINE) {
      result.responses = submission.responses.map((r) => {
        const correctOption = r.question.options.find(opt => opt.isCorrect);
        return {
          questionText: r.question.text,
          yourAnswer: r.selectedOption?.text || (r as any).writtenAnswer || 'Not Answered',
          correctAnswer: correctOption?.text || 'N/A',
          isCorrect: r.isCorrect,
        };
      });
    }
    
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error fetching quiz result:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch result.' });
  }
};

export const getQuizAnalyticsController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const questionDifficultyPipeline = [
            { $match: { quizId: { $oid: quizId } } },
            { $unwind: '$responses' },
            {
                $group: {
                    _id: '$responses.questionId',
                    totalAttempts: { $sum: 1 },
                    incorrectAttempts: {
                        $sum: { $cond: [{ $eq: ['$responses.isCorrect', false] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'Question',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'questionDetails'
                }
            },
            {
                $project: {
                    _id: 0,
                    questionId: '$_id',
                    questionText: { $arrayElemAt: ['$questionDetails.text', 0] },
                    difficulty: { $multiply: [{ $divide: ['$incorrectAttempts', '$totalAttempts'] }, 100] }
                }
            },
        ];
        const questionDifficulty = await prisma.quizSubmission.aggregateRaw({
            pipeline: questionDifficultyPipeline,
        });
        const cohortPerformancePipeline = [
            { $match: { quizId: { $oid: quizId }, status: 'COMPLETED' } },
            {
                $lookup: {
                    from: 'User',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            { $unwind: '$userDetails' },
            {
                $group: {
                    _id: '$userDetails.department',
                    averageScore: { $avg: '$score' },
                    numberOfStudents: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    cohort: '$_id',
                    averageScore: 1,
                    numberOfStudents: 1,
                }
            }
        ];
        const cohortPerformance = await prisma.quizSubmission.aggregateRaw({
            pipeline: cohortPerformancePipeline,
        });
        res.status(200).json({
            success: true,
            analytics: {
                questionDifficulty,
                cohortPerformance,
            },
        });

    } catch (error) {
        console.error('Error generating quiz analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to generate analytics.' });
    }
};

export const getQuizController = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const userId = (req as any).user.id;
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId, status: 'PUBLISHED', isLatest: true },
      include: {
        questions: {
          select: {
            id: true,
            text: true,
            options: true,
            type: true,
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found or not published.' });
    }
    res.status(200).json({ success: true, quiz });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quiz.' });
  }
};

export const getQuizzesController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const enrolledCourses = await prisma.courseEnrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });
    const courseIds = enrolledCourses
      .map(e => e.courseId)
      .filter((id): id is string => !!id);

    const quizzes = await prisma.quiz.findMany({
      where: {
        isLatest: true,
        status: 'PUBLISHED',
        courseId: { in: courseIds },
      },
      select: {
        id: true,
        title: true,
        description: true,
        timeLimit: true,
        totalMarks: true,
        course: { select: { title: true } },
      },
    });

    res.status(200).json({ success: true, quizzes });
  } catch (error) {
    console.error('Error fetching quizzes for user:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes.' });
  }
};

export const getAllQuizzesForAuditController = async (req: Request, res: Response) => {
  try {
    const allQuizzes = await prisma.quiz.findMany({
  orderBy: { createdAt: 'desc' },
  include: {
    createdBy: { select: { id: true, name: true, email: true } },
    course: { select: { id: true, title: true } },
  },
});

const safeQuizzes = allQuizzes.filter((q) => q.course !== null);

res.status(200).json({
  success: true,
  message: 'All quizzes fetched successfully for audit.',
  quizzes: safeQuizzes,
});


    res.status(200).json({
      success: true,
      message: 'All quizzes fetched successfully for audit.',
      quizzes: allQuizzes,
    });
  } catch (error) {
    console.error('Error fetching all quizzes for audit:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes for audit.' });
  }
};

export const getQuizzesForTeacherController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const assignments = await prisma.courseTeacher.findMany({
        where: { teacherId: userId },
        select: { courseId: true },
    });
    const courseIds = assignments.map((assignment: { courseId: any; }) => assignment.courseId);
    const quizzes = await prisma.quiz.findMany({
      where: { 
        courseId: { in: courseIds },
        status: { not: 'ARCHIVED' },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, quizzes });
  } catch (error) {
    console.error("Failed to fetch quizzes for teacher:", error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes.' });
  }
};

export const getQuizDetailsForAdminController = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        course: { select: { title: true } },
        createdBy: { select: { name: true, email: true } },
        questions: {
          orderBy: { createdAt: 'asc' },
          include: {
            options: true,
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }
    res.status(200).json({ success: true, quiz });
  } catch (error) {
    console.error('Error fetching quiz details for admin:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quiz details.' });
  }
};

export const addBulkQuestionsController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;
        const { questions } = req.body;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, message: 'A valid questions array is required.' });
        }
        const createOperations = questions.map((q: any) => 
            prisma.question.create({
                data: {
                    text: q.text,
                    marks: q.marks,
                    type: 'MCQ', 
                    quiz: { connect: { id: quizId } },
                    options: {
                        create: q.options.map((opt: any) => ({
                            text: opt.text,
                            isCorrect: opt.isCorrect,
                        })),
                    },
                },
            })
        );
        await prisma.$transaction(createOperations);
        res.status(201).json({ success: true, message: `${questions.length} questions added successfully.` });
    } catch (error) {
        console.error('Error adding bulk questions:', error);
        res.status(500).json({ success: false, message: 'Failed to add questions. Please check your data format.' });
    }
};

export const getQuizzesByCourseController = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;
        const userId = (req as any).user.id;
        const enrollment = await prisma.courseEnrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
        });

        if (!enrollment) {
            return res.status(403).json({ success: false, message: "You are not enrolled in this course." });
        }

        const quizzes = await prisma.quiz.findMany({
            where: {
                courseId: courseId,
                status: 'PUBLISHED',
                isLatest: true,
            },
            select: { id: true, title: true, description: true, timeLimit: true },
        });
        
        res.status(200).json({ success: true, quizzes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch quizzes.' });
    }
};

export const getQuizzesForAssistantController = async (req: Request, res: Response) => {
    try {
        const existingCourses = await prisma.course.findMany({
            where: { isDeleted: false },
            select: { id: true },
        });
        const existingCourseIds = existingCourses.map(course => course.id);
        const quizzes = await prisma.quiz.findMany({
            where: {
                status: { not: 'ARCHIVED' },
                isLatest: true,
                courseId: { in: existingCourseIds }, 
            },
            include: {
                course: { select: { title: true } },
                createdBy: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json({ success: true, quizzes });
    } catch (error) {
        console.error("Failed to fetch quizzes for assistant:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch quizzes.' });
    }
};

