import { Request, Response } from "express";
import prisma from "../../config/db";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "../../services/notification.service";

export const createLiveLecture = async (req: Request, res: Response) => {
  try {
    const { title, courseId, teacherId, startTime, endTime } = req.body;
    const roomId = uuidv4();
    const lecture = await prisma.liveLecture.create({
      data: {
        title,
        courseId,
        teacherId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        roomId,
      },
    });

    if (courseId) {
      await NotificationService.notifyAllCourseStakeholders(
        courseId,
        'LIVE_LECTURE_SCHEDULED',
        'New Live Lecture Scheduled',
        `A new live lecture "${title}" has been scheduled. Starts at ${new Date(startTime).toLocaleString()}.`,
        {
          lectureId: lecture.id,
          courseId,
          startTime,
          endTime,
          roomId: lecture.roomId
        },
        {
          notifyStudents: true,       
          notifyTeachers: true,       
          notifyAssistants: true,     
          notifyAdmins: false,        
          notifySuperAdmins: false,    
        }
      );
    }

    res.status(201).json({ success: true, lecture });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getLiveLecturesByCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = (req as any).user.id;

    
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not enrolled in this course.",
      });
    }

 
    const lectures = await prisma.liveLecture.findMany({
      where: { courseId },
      orderBy: { startTime: "asc" },
    });

    if (lectures.length === 0) {
      return res.json({
        success: true,
        lectures: [],
        message: "No live lectures scheduled for this course yet.",
      });
    }

    res.json({ success: true, lectures });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const joinLecture = async (req: Request, res: Response) => {
  try {
    const { lectureId } = req.params;
    const userId = (req as any).user.id;

   
    const lecture = await prisma.liveLecture.findUnique({
      where: { id: lectureId },
      select: { roomId: true }
    });

    if (!lecture) {
      return res.status(404).json({ success: false, message: "Lecture not found" });
    }

    const participant = await prisma.lectureParticipant.upsert({
      where: { lectureId_userId: { lectureId, userId } },
      update: {},
      create: { lectureId, userId },
    });

  
    res.json({ 
      success: true, 
      participant,
      roomId: lecture.roomId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getLectureParticipants = async (req: Request, res: Response) => {
  try {
    const { lectureId } = req.params;

    const participants = await prisma.lectureParticipant.findMany({
      where: { lectureId },
      include: { participant: true },
    });

    res.json({ success: true, participants });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


export const getLiveLecturesByTeacher = async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params;

    const lectures = await prisma.liveLecture.findMany({
      where: { teacherId },
      include: {
        course: { select: { id: true, title: true } },
      },
      orderBy: { startTime: "asc" },
    });

    const safeLectures = lectures.filter((l) => l.course !== null);
    
    res.json({ success: true, lectures: safeLectures });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getLiveLectureById = async (req: Request, res: Response) => {
  try {
    const { lectureId } = req.params;

    const lecture = await prisma.liveLecture.findUnique({
      where: { id: lectureId },
      include: {
        teacher: true,
      },
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    res.json(lecture);
  } catch (error) {
    console.error("Error fetching lecture:", error);
    res.status(500).json({ message: "Error fetching lecture", error });
  }
};


export const getStudentLiveLectures = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });

    if (enrollments.length === 0) {
      return res.json({ success: true, lectures: [] });
    }

    const courseIds = enrollments.map((e) => e.courseId).filter((id): id is string => id !== null);

    const lectures = await prisma.liveLecture.findMany({
      where: {
        courseId: { in: courseIds },
        isActive: true,
      },
      include: {
        course: { 
          select: { 
            id: true, 
            title: true,
            thumbnailUrl: true,   
          } 
        },
        teacher: { 
          select: { 
            id: true, 
            name: true,
            profilePic: true,    
          } 
        }, 
      },
      orderBy: { startTime: "asc" },
    });

    res.json({ success: true, lectures });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


