import { Request, Response } from 'express';
import { ExportService } from '../services/export.service';

export class ExportController {
  static async exportUsers(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportUsers(format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export users error:', error);
      res.status(500).json({ success: false, message: 'Failed to export users data' });
    }
  }

  static async exportCourses(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportCourses(format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export courses error:', error);
      res.status(500).json({ success: false, message: 'Failed to export courses data' });
    }
  }

  static async exportAssessments(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportAssessments(format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export assessments error:', error);
      res.status(500).json({ success: false, message: 'Failed to export assessments data' });
    }
  }

  static async exportAssessmentSubmissions(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportAssessmentSubmissions(format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export assessment submissions error:', error);
      res.status(500).json({ success: false, message: 'Failed to export assessment submissions data' });
    }
  }

  static async exportQuizzes(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportQuizzes(format);  
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export quizzes error:', error);
      res.status(500).json({ success: false, message: 'Failed to export quizzes data' });
    }
  }

  static async exportQuizSubmissions(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportQuizSubmissions(format); 
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export quiz submissions error:', error);
      res.status(500).json({ success: false, message: 'Failed to export quiz submissions data' });
    }
  }

  static async exportCertificates(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportCertificates(format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export certificates error:', error);
      res.status(500).json({ success: false, message: 'Failed to export certificates data' });
    }
  }

  static async exportLiveLectures(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportLiveLectures(format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export live lectures error:', error);
      res.status(500).json({ success: false, message: 'Failed to export live lectures data' });
    }
  }

  static async exportNotifications(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportNotifications(format); 
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export notifications error:', error);
      res.status(500).json({ success: false, message: 'Failed to export notifications data' });
    }
  }

  static async exportEnrollments(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportEnrollments(format);  
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export enrollments error:', error);
      res.status(500).json({ success: false, message: 'Failed to export enrollments data' });
    }
  }

  static async exportSystemStats(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'csv';
      const result = await ExportService.exportSystemStats(format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export system stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to export system statistics' });
    }
  }

  static async exportAllData(req: Request, res: Response) {
    try {
      const format = (req.query.format as 'csv' | 'xlsx') || 'xlsx';
      if (format === 'csv') {
        return res.status(400).json({ 
          success: false, 
          message: 'Complete export is only available in Excel format. Use ?format=xlsx' 
        });
      }
      const result = await ExportService.exportAllData(format); 
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      console.error('Export all data error:', error);
      res.status(500).json({ success: false, message: 'Failed to export complete data' });
    }
  }

  static async getExportMenu(req: Request, res: Response) {
    try {
      const exportOptions = [
        {
          id: 'users',
          name: 'Users',
          description: 'Export all user data including profiles, roles, and statistics',
          endpoint: '/api/v1/superadmin/export/users',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'courses',
          name: 'Courses',
          description: 'Export all course data including details, teachers, and enrollments',
          endpoint: '/api/v1/superadmin/export/courses',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'assessments',
          name: 'Assessments',
          description: 'Export all assessment data including questions and assignments',
          endpoint: '/api/v1/superadmin/export/assessments',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'assessment-submissions',
          name: 'Assessment Submissions',
          description: 'Export all assessment submissions with grades and feedback',
          endpoint: '/api/v1/superadmin/export/assessment-submissions',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'quizzes',
          name: 'Quizzes',
          description: 'Export all quiz data including questions and settings',
          endpoint: '/api/v1/superadmin/export/quizzes',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'quiz-submissions',
          name: 'Quiz Submissions',
          description: 'Export all quiz submissions with scores and responses',
          endpoint: '/api/v1/superadmin/export/quiz-submissions',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'certificates',
          name: 'Certificates',
          description: 'Export all issued certificates and recipient details',
          endpoint: '/api/v1/superadmin/export/certificates',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'live-lectures',
          name: 'Live Lectures',
          description: 'Export all live lecture data including participants',
          endpoint: '/api/v1/superadmin/export/live-lectures',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'notifications',
          name: 'Notifications',
          description: 'Export all system notifications and their status',
          endpoint: '/api/v1/superadmin/export/notifications',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'enrollments',
          name: 'Course Enrollments',
          description: 'Export all course enrollment data with progress tracking',
          endpoint: '/api/v1/superadmin/export/enrollments',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'system-stats',
          name: 'System Statistics',
          description: 'Export comprehensive system statistics and metrics',
          endpoint: '/api/v1/superadmin/export/system-stats',
          formats: ['csv', 'xlsx']
        },
        {
          id: 'complete',
          name: 'Complete Export',
          description: 'Export all data in a single Excel file with multiple sheets',
          endpoint: '/api/v1/superadmin/export/complete',
          formats: ['xlsx'],
          note: 'This is a comprehensive export that includes all data types in one file'
        }
      ];

      res.status(200).json({
        success: true,
        message: 'Export options retrieved successfully',
        data: {
          totalOptions: exportOptions.length,
          exports: exportOptions,
          usage: {
            formats: {
              csv: 'Comma-separated values - compatible with Excel, Google Sheets',
              xlsx: 'Excel format - supports multiple sheets and better formatting'
            },
            parameters: {
              format: 'Add ?format=csv or ?format=xlsx to specify export format (default: csv)'
            },
            examples: [
              'GET /api/v1/superadmin/export/users?format=xlsx',
              'GET /api/v1/superadmin/export/courses?format=csv',
              'GET /api/v1/superadmin/export/complete?format=xlsx'
            ]
          }
        }
      });
    } catch (error) {
      console.error('Get export menu error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve export options' });
    }
  }
}
