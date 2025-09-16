import cron from 'node-cron';
import { AssessmentReminderService } from '../services/assessmentReminder.service';

export const initCronJobs = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('Running assessment reminder check...');
    await AssessmentReminderService.sendDueReminders();
  });
};
