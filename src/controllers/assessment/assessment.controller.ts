import { Request, Response } from 'express';
import prisma from '../../config/db'; 
import { generatePresignedUploadUrl } from '../../utils/s3.utils';
import { generateSignedCloudFrontUrl } from '../../utils/cloudfront.utils';
import { NotificationService } from '../../services/notification.service';

export const createAssessmentController = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;
        const { title, description, dueDate, totalMarks, submissionType, questions } = req.body;
        const user = (req as any).user;
        const newAssessment = await prisma.assessment.create({
            data: {
                courseId,
                title,
                description,
                dueDate: new Date(dueDate),
                totalMarks: parseInt(totalMarks),
                submissionType,
                createdById: user.id,
                questions: { create: questions || [] },
            },
        });
        await NotificationService.notifyAllCourseStakeholders(
            courseId,
            'ASSESSMENT_PUBLISHED',
            'New Assessment Available',
            `A new assessment "${title}" has been published in the course.`,
            { assessmentId: newAssessment.id, courseId },
            {
                notifyStudents: true,       
                notifyTeachers: true,       
                notifyAssistants: true,   
                notifyAdmins: false,        
                notifySuperAdmins: false,   
            }
        );

        res.status(201).json({ success: true, assessment: newAssessment });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to create assessment." });
    }
};

export const submitAssessmentController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const studentId = (req as any).user.id;
        const { fileUrl, textContent } = req.body;
        const submission = await prisma.assessmentSubmission.upsert({
            where: { assessmentId_studentId: { assessmentId, studentId } },
            update: { fileUrl, textContent, status: 'SUBMITTED', submittedAt: new Date() },
            create: { assessmentId, studentId, fileUrl, textContent, status: 'SUBMITTED', submittedAt: new Date() },
        });
        const assessment = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: {
                course: { select: { title: true } },
                createdBy: { select: { id: true } },
                assignedAssistants: { select: { assistantId: true } }
            }
        });
        if (assessment) {
            const recipientIds = [
                assessment.createdBy.id,
                ...assessment.assignedAssistants.map(a => a.assistantId)
            ];

            await NotificationService.createMultipleNotifications(
                'ASSESSMENT_SUBMITTED',
                'New Assessment Submission',
                `A student has submitted their work for "${assessment.title}"`,
                recipientIds,
                { assessmentId, submissionId: submission.id, courseId: assessment.courseId }
            );
        }

        res.status(200).json({ success: true, submission });
    } catch (error) {
        console.error("Failed to submit assessment:", error);
        res.status(500).json({ success: false, message: "Failed to submit assessment." });
    }
};

export const gradeAssessmentController = async (req: Request, res: Response) => {
    try {
        const { submissionId } = req.params;
        const gradedById = (req as any).user.id;
        const { grade, feedback } = req.body;
        const gradedSubmission = await prisma.assessmentSubmission.update({
            where: { id: submissionId },
            data: { grade: parseFloat(grade), feedback, status: 'GRADED', gradedAt: new Date(), gradedById },
            include: {
                assessment: {
                    select: {
                        title: true,
                        courseId: true
                    }
                }
            }
        });
        await NotificationService.createNotification({
            type: 'ASSESSMENT_GRADED',
            title: 'Assessment Graded',
            message: `Your submission for "${gradedSubmission.assessment.title}" has been graded.`,
            recipientId: gradedSubmission.studentId,
            metadata: {
                assessmentId: gradedSubmission.assessmentId,
                submissionId: gradedSubmission.id,
                courseId: gradedSubmission.assessment.courseId,
                grade: grade
            }
        });

        res.status(200).json({ success: true, submission: gradedSubmission });
    } catch (error) {
        console.error("Failed to grade submission:", error);
        res.status(500).json({ success: false, message: "Failed to grade submission." });
    }
};

export const getAssessmentDetailsController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;
        if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
            const assessment = await prisma.assessment.findFirst({
                where: { id: assessmentId, isDeleted: false },
                include: {
                    course: { 
                        select: { 
                            id: true,
                            title: true,
                        } 
                    },
                    createdBy: { select: { name: true, email: true } },
                    questions: {
                        select: {
                            id: true,
                            text: true,
                            marks: true,
                        }
                    },
                    assignedAssistants: {
                        include: {
                            assistant: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            });
            
            if (!assessment) {
                return res.status(404).json({ success: false, message: "Assessment not found." });
            }
            
            return res.status(200).json({ success: true, assessment });
        }
        if (userRole === 'TEACHER') {
            const assessment = await prisma.assessment.findFirst({
                where: { 
                    id: assessmentId, 
                    isDeleted: false,
                    OR: [
                        { createdById: userId },
                        { 
                            assignedAssistants: {
                                some: {
                                    assistantId: userId
                                }
                            }
                        }
                    ]
                },
                include: {
                    course: { 
                        select: { 
                            id: true,
                            title: true,
                        } 
                    },
                    createdBy: { select: { name: true, email: true } },
                    questions: {
                        select: {
                            id: true,
                            text: true,
                            marks: true,
                        }
                    },
                    assignedAssistants: {
                        include: {
                            assistant: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            });
            
            if (!assessment) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Assessment not found or you don't have access to it." 
                });
            }
            
            return res.status(200).json({ success: true, assessment });
        }
        if (userRole === 'ASSISTANT') {
            const assessment = await prisma.assessment.findFirst({
                where: { 
                    id: assessmentId, 
                    isDeleted: false,
                    assignedAssistants: {
                        some: {
                            assistantId: userId
                        }
                    }
                },
                include: {
                    course: { 
                        select: { 
                            id: true,
                            title: true,
                        } 
                    },
                    createdBy: { select: { name: true, email: true } },
                    questions: {
                        select: {
                            id: true,
                            text: true,
                            marks: true,
                        }
                    }
                }
            });
            
            if (!assessment) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Assessment not found or you're not assigned to it." 
                });
            }
            
            return res.status(200).json({ success: true, assessment });
        }
        return res.status(403).json({ success: false, message: "Please use the student endpoint." });
        
    } catch (error) {
        console.error("Failed to fetch assessment details:", error);
        res.status(500).json({ success: false, message: "Failed to fetch assessment details." });
    }
};

export const getAssessmentDetailsForStudentController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const userId = (req as any).user.id;
        
        const assessment = await prisma.assessment.findFirst({
            where: { id: assessmentId, isDeleted: false },
            include: {
                course: { 
                    select: { 
                        id: true,
                        title: true,
                        enrollments: {
                            where: { userId: userId },
                            select: { id: true }
                        }
                    } 
                },
                createdBy: { select: { name: true, email: true } },
                questions: {
                    select: {
                        id: true,
                        text: true,
                        marks: true,
                    }
                }
            }
        });
        if (!assessment || !assessment.course.enrollments || assessment.course.enrollments.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: "You are not enrolled in this course or the assessment doesn't exist." 
            });
        }
        const submission = await prisma.assessmentSubmission.findUnique({
            where: { assessmentId_studentId: { assessmentId, studentId: userId } },
        });
        
        return res.status(200).json({ success: true, assessment, submission });
        
    } catch (error) {
        console.error("Failed to fetch assessment details:", error);
        res.status(500).json({ success: false, message: "Failed to fetch assessment details." });
    }
};

export const getSubmissionsForAssessmentController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const submissions = await prisma.assessmentSubmission.findMany({
            where: { assessmentId },
            include: { student: { select: { name: true, email: true } } },
            orderBy: { submittedAt: 'desc' },
        });
        res.status(200).json({ success: true, submissions });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch submissions." });
    }
};

export const getAllAssessmentsController = async (req: Request, res: Response) => {
    try {
        const assessments = await prisma.assessment.findMany({
            where: { isDeleted: false, createdBy: { isNot: undefined } },
            include: {
                course: { select: { title: true } },
                _count: { select: { submissions: true } },
                createdBy: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, assessments });
    } catch (error) {
        console.error("Failed to fetch assessments:", error);
        res.status(500).json({ success: false, message: "Failed to fetch assessments." });
    }
};

export const updateAssessmentController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { title, description, dueDate, totalMarks, submissionType, courseId } = req.body;
        const updatedAssessment = await prisma.assessment.update({
            where: { id: assessmentId },
            data: {
                title,
                description,
                dueDate: new Date(dueDate),
                totalMarks: parseInt(totalMarks),
                submissionType,
                courseId,
            },
            include: {
                course: { select: { title: true } },
                _count: { select: { submissions: true } },
                createdBy: { select: { name: true } },
            },
        });
        res.status(200).json({ success: true, assessment: updatedAssessment });
    } catch (error) {
        console.error("Error updating assessment:", error);
        res.status(500).json({ success: false, message: "Failed to update assessment." });
    }
};

export const deleteAssessmentController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        await prisma.assessment.update({ where: { id: assessmentId }, data: { isDeleted: true } });
        res.status(200).json({ success: true, message: 'Assessment deleted successfully.' });
    } catch (error) { res.status(500).json({ success: false, message: "Failed to delete assessment." }); }
};

export const getAssessmentAnalyticsController = async (req: Request, res: Response) => {
     try {
        const { assessmentId } = req.params;
        const submissions = await prisma.assessmentSubmission.findMany({
            where: { assessmentId: assessmentId, status: 'GRADED' },
            select: { grade: true }
        });
        if (submissions.length === 0) {
            return res.status(200).json({ success: true, analytics: { averageGrade: 0, submissionCount: 0, highestGrade: 0, lowestGrade: 0 } });
        }
        const grades = submissions.map(s => s.grade).filter(g => g !== null) as number[];
        const averageGrade = grades.reduce((a, b) => a + b, 0) / grades.length; 
        const analytics = {
            averageGrade,
            submissionCount: submissions.length,
            highestGrade: Math.max(...grades),
            lowestGrade: Math.min(...grades),
        };
        res.status(200).json({ success: true, analytics });
    } catch (error) { res.status(500).json({ success: false, message: "Failed to fetch analytics." }); }
};

export const addBulkAssessmentQuestionsController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { questions } = req.body; 
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, message: 'A valid questions array is required.' });
        }
        const questionsToCreate = questions.map((q: { text: string; marks: number; }) => ({
            text: q.text,
            marks: q.marks,
            assessmentId: assessmentId,
        }));
        await prisma.assessmentQuestion.createMany({
            data: questionsToCreate,
        });

        res.status(201).json({ success: true, message: `${questions.length} questions added successfully.` });
    } catch (error) {
        console.error('Error adding bulk questions:', error);
        res.status(500).json({ success: false, message: 'Failed to add questions.' });
    }
};

export const getMyAssessmentsController = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const assessments = await prisma.assessment.findMany({
            where: {
                createdById: userId, 
                isDeleted: false,
            },
            include: {
                course: { select: { title: true } },
                _count: { select: { submissions: true } },
                createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, assessments });
    } catch (error) {
        console.error("Failed to fetch teacher's assessments:", error);
        res.status(500).json({ success: false, message: "Failed to fetch assessments." });
    }
};

export const getAssessmentsForAssistantController = async (req: Request, res: Response) => {
    try {
        const assessments = await prisma.assessment.findMany({
            where: { isDeleted: false },
            include: {
                course: { select: { title: true } },
                createdBy: { select: { name: true, email: true } },
                _count: { select: { submissions: true } }
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, assessments });
    } catch (error) {
        console.error("Failed to fetch assessments for assistant:", error);
        res.status(500).json({ success: false, message: "Failed to fetch assessments." });
    }
};

export const getAssessmentsByCourseController = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;
        const userId = (req as any).user.id
        const enrollment = await prisma.courseEnrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
        });

        if (!enrollment) {
            return res.status(403).json({ success: false, message: "You are not enrolled in this course." });
        }
        const assessments = await prisma.assessment.findMany({
            where: {
                courseId: courseId,
                isDeleted: false,
            },
            orderBy: { createdAt: 'asc' },
        });
        res.status(200).json({ success: true, assessments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch assessments.' });
    }
};

export const getPresignedUrlController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { fileName, fileType } = req.body;
        const userId = (req as any).user.id;
        const key = `submissions/${assessmentId}/${userId}/${Date.now()}-${fileName}`;
        const uploadUrl = await generatePresignedUploadUrl(key, fileType);
        res.status(200).json({ success: true, uploadUrl });
    } catch (error) {
        console.error("Failed to generate presigned URL:", error);
        res.status(500).json({ success: false, message: 'Failed to generate presigned URL.' });
    }
};

export const getSubmissionUrlController = async (req: Request, res: Response) => {
    try {
        const { submissionId } = req.params;
        const submission = await prisma.assessmentSubmission.findUnique({
            where: { id: submissionId },
            select: { fileUrl: true }
        });
        if (!submission || !submission.fileUrl) {
            return res.status(404).json({ success: false, message: 'Submission file not found.' });
        }
        const s3Key = new URL(submission.fileUrl).pathname.substring(1);
        const signedUrl = generateSignedCloudFrontUrl(s3Key);
        res.status(200).json({ success: true, signedUrl });
    } catch (error) {
        console.error("Failed to generate secure URL:", error);
        res.status(500).json({ success: false, message: 'Failed to generate secure URL.' });
    }
};
export const assignAssistantController = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { assistantId } = req.body;
        const user = (req as any).user;
        const assistantUser = await prisma.user.findFirst({ where: { id: assistantId, role: 'ASSISTANT' } });
        if (!assistantUser) {
            return res.status(404).json({ success: false, message: "User is not an Assistant or does not exist." });
        }
        const assessment = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: {
                course: {
                    select: { id: true, title: true }
                }
            }
        });

        if (!assessment) {
            return res.status(404).json({ success: false, message: "Assessment not found." });
        }
        await prisma.assessmentAssistant.create({
            data: { assessmentId, assistantId },
        });
        await NotificationService.notifyAssistantGradingAssignment(
            assistantId,
            assessmentId,
            assessment.title,
            assessment.course.id,
            assessment.course.title,
            user.name || 'Teacher',
            {
                assignedById: user.id,
                dueDate: assessment.dueDate?.toISOString(),
                gradingInstructions: 'Please review and grade the submitted assessments according to the rubric.'
            }
        );

        res.status(200).json({ 
            success: true, 
            message: 'Assistant has been granted access and notified.' 
        });
    } catch (error) {
        console.error('Error assigning assistant:', error);
        res.status(500).json({ success: false, message: 'Failed to assign assistant. They may already have access.' });
    }
};

export const getAssignedAssessmentsForAssistantController = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const assignments = await prisma.assessmentAssistant.findMany({
            where: { assistantId: userId },
            include: {
                assessment: {
                    include: {
                        course: { select: { title: true } },
                        createdBy: { select: { name: true } },
                        _count: { select: { submissions: true } },
                    },
                },
            },
        });
        
      
        const assessments = assignments
            .map((a: { assessment: any; }) => a.assessment)
            .filter((a: { isDeleted: any; } | null) => a && !a.isDeleted); 
        res.status(200).json({ success: true, assessments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch assigned assessments.' });
    }
};


