import { Request, Response } from 'express';

import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, uploadPrivateFileToS3 } from 'utils/s3.utils';
import { PrismaClient } from 'generated/prisma';

const prisma = new PrismaClient();
const PRIVATE_BUCKET_NAME = process.env.AWS_PRIVATE_S3_BUCKET_NAME as string;

export const generatePresignedViewUrl = async (key: string): Promise<string> => {
  if (!PRIVATE_BUCKET_NAME) {
    throw new Error("AWS_PRIVATE_S3_BUCKET_NAME is not defined in environment variables.");
  }
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

export const recordedLectureController = {
  uploadLecture: async (req: Request, res: Response) => {
    const file = (req as any).file;
    const { title, description, courseId, moduleId, duration, order } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    if (!duration || !order) {
      return res.status(400).json({ error: 'Missing required fields: duration or order.' });
    }
    try {
      const filename = `lectures/${Date.now()}-${file.originalname}`;
      const videoUrl = await uploadPrivateFileToS3(file.buffer, file.mimetype, filename);
      const newLecture = await prisma.recordedLecture.create({
        data: {
          title,
          description,
          videoUrl,
          courseId,
          moduleId,
          duration: Number(duration),
          order: Number(order)
        },
      });
      res.status(201).json({
        message: 'Lecture uploaded successfully!',
        lecture: newLecture,
      });
    } catch (error) {
      console.error('Error uploading lecture:', error);
      res.status(500).json({ error: 'Failed to upload lecture.' });
    }
  },

  getLecturesByCourse: async (req: Request, res: Response) => {
  const { courseId } = req.params;

  try {
    const lectures = await prisma.recordedLecture.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    });

    res.status(200).json(lectures);
  } catch (error) {
    console.error('Error fetching lectures:', error);
    res.status(500).json({ error: 'Failed to retrieve lectures.' });
  }
},


  getLectureProgress: async (req: Request, res: Response) => {
    const { userId, recordedLectureId } = req.params;
    try {
      const lectureProgress = await prisma.lectureProgress.findUnique({
        where: { userId_recordedLectureId: { userId, recordedLectureId } },
      });
      if (!lectureProgress) {
        return res.status(200).json({ progress: 0, completed: false });
      }
      res.status(200).json(lectureProgress);
    } catch (error) {
      console.error('Error fetching lecture progress:', error);
      res.status(500).json({ error: 'Failed to retrieve lecture progress.' });
    }
  },

  getSignedUrl: async (req: Request, res: Response) => {
    const { lectureId } = req.params;
    try {
      const lecture = await prisma.recordedLecture.findUnique({
        where: { id: lectureId },
        select: { videoUrl: true }
      });
      if (!lecture) {
        return res.status(404).json({ error: 'Lecture not found.' });
      }
      const url = new URL(lecture.videoUrl);
      const key = url.pathname.substring(1);
      const getCommand = new GetObjectCommand({
        Bucket: PRIVATE_BUCKET_NAME,
        Key: key,
      });
      const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
      res.status(200).json({ signedUrl });
    } catch (error) {
      console.error('Error generating signed URL:', error);
      res.status(500).json({ error: 'Failed to generate signed URL.' });
    }
  },

updateLecture: async (req: Request, res: Response) => {
  const { lectureId } = req.params;
  const { title, description, order, duration } = req.body;

  try {
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = Number(order);
    if (duration !== undefined) updateData.duration = Number(duration);

    const updatedLecture = await prisma.recordedLecture.update({
      where: { id: lectureId },
      data: updateData,
    });

    res.status(200).json({
      message: "Lecture updated successfully!",
      lecture: updatedLecture,
    });
  } catch (error: any) {
    console.error("Error updating lecture:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Lecture not found." });
    }

    res.status(500).json({ error: "Failed to update lecture." });
  }
},

  deleteLecture: async (req: Request, res: Response) => {
  const { lectureId } = req.params;
  try {
    const lectureToDelete = await prisma.recordedLecture.findUnique({
      where: { id: lectureId },
    });
    if (!lectureToDelete) {
      return res.status(404).json({ error: 'Lecture not found.' });
    }
    const url = new URL(lectureToDelete.videoUrl);
    const key = url.pathname.substring(1);
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: PRIVATE_BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(deleteObjectCommand);
    await prisma.recordedLecture.delete({
      where: { id: lectureId },
    });
    res.status(200).json({ message: 'Lecture deleted successfully.' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    res.status(500).json({ error: 'Failed to delete lecture.' });
  }
},


  updateLectureProgress: async (req: Request, res: Response) => {
    const { userId, recordedLectureId } = req.params;
    const { progress } = req.body;
    if (progress === undefined) {
      return res.status(400).json({ error: 'Progress value is missing.' });
    }
    try {
      const lecture = await prisma.recordedLecture.findUnique({
        where: { id: recordedLectureId },
        select: { courseId: true }
      });
      if (!lecture) {
        return res.status(404).json({ error: 'Lecture not found.' });
      }
      const isCompleted = progress >= 90;
      await prisma.lectureProgress.upsert({
        where: { userId_recordedLectureId: { userId, recordedLectureId } },
        update: { progress: Number(progress), completed: isCompleted },
        create: { userId, recordedLectureId, progress: Number(progress), completed: isCompleted }
      });
      const totalLectures = await prisma.recordedLecture.count({ where: { courseId: lecture.courseId } });
      const completedLectures = await prisma.lectureProgress.count({
        where: {
          userId,
          recordedLecture: {
            courseId: lecture.courseId
          },
          completed: true
        }
      });
      const courseProgress = totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0;
      await prisma.courseEnrollment.update({
        where: { userId_courseId: { userId, courseId: lecture.courseId } },
        data: { progress: Math.round(courseProgress) }
      });
      res.status(200).json({ message: 'Lecture progress updated successfully.' });
    } catch (error) {
      console.error('Error updating lecture progress:', error);
      res.status(500).json({ error: 'Failed to update lecture progress.' });
    }
  }
  
};