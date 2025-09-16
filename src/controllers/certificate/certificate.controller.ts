
import { Request, Response } from "express";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { v4 as uuidv4 } from "uuid";
import streamBuffers from "stream-buffers";
import { generatePresignedDownloadUrl, uploadPrivateFileToS3 } from "utils/s3.utils";
import prisma from "../../config/db";
import { sendCertificateEmail, sendCertificateVerificationEmail } from "services/email.service";
import { generateVerifiedCertificate } from "utils/generateVerifiedCertificate";
import { Prisma } from "generated/prisma";
import path from "path";
import * as fs from 'fs';


export const generateCertificate = async (req: Request, res: Response) => {
  try {
    const { userId, courseId, issuedById: issuedByIdBody, issuedBy, collegese_lms_id } = req.body;
    const issuedById = issuedByIdBody || issuedBy;

    if (!userId || !courseId) {
      return res.status(400).json({ error: "userId and courseId are required" });
    }

    const [user, course] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.course.findUnique({ where: { id: courseId } }),
    ]);

    if (!user || !course) {
      return res.status(404).json({ message: "User or Course not found" });
    }

    const certificateId = uuidv4();
    const verifyUrl = `${process.env.APP_URL}/verify/${certificateId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);

    const doc = new PDFDocument({ 
      size: "A4", 
      layout: "landscape", 
      margin: 0 
    });
    const pdfBuffer = new streamBuffers.WritableStreamBuffer();
    doc.pipe(pdfBuffer);

    const width = doc.page.width;
    const height = doc.page.height;

    
    const orangeWidth = width * 0.25; 
    const whiteWidth = width * 0.75;
    
    
    doc.rect(0, 0, whiteWidth, height).fill("#FFFFFF");
    
   
    const gradient = doc.linearGradient(width - orangeWidth, 0, width, height);
    gradient.stop(0, "#FF8C42").stop(0.3, "#FF6B1A").stop(0.6, "#FF4500").stop(1, "#E63946");
    doc.rect(width - orangeWidth, 0, orangeWidth, height).fill(gradient);
    
    
    doc.save();
    doc.translate(width * 0.8, 0);
    doc.scale(1.2, 1);
    doc.circle(width * 0.2, height * 0.5, height * 0.8).fill("rgba(255, 255, 255, 0.1)");
    doc.restore();

  
    doc.rect(30, 30, whiteWidth - 60, height - 60)
       .lineWidth(2)
       .strokeColor("#D4AF37")
       .stroke();

   
    doc.font("Times-Bold")
       .fontSize(48)
       .fillColor("#2C3E50")
       .text("CERTIFICATE", 60, 80, {
         width: whiteWidth - 120,
         align: "center"
       });

    
    doc.font("Helvetica")
       .fontSize(20)
       .fillColor("#7F8C8D")
       .text("Of Completion", 60, 140, {
         width: whiteWidth - 120,
         align: "center"
       });

  
    const nameY = 200;
    const fontPath = path.resolve(process.cwd(), "src/utils/assets/fonts/DancingScript-VariableFont_wght.ttf");
    
    try {
      const fontBuffer = fs.readFileSync(fontPath);
      doc.font(fontBuffer as any)
         .fontSize(44)
         .fillColor("#2C3E50")
         .text(user.name, 60, nameY, {
           width: whiteWidth - 120,
           align: "center"
         });
    } catch (error) {
     
      doc.font("Times-Italic")
         .fontSize(44)
         .fillColor("#2C3E50")
         .text(user.name, 60, nameY, {
           width: whiteWidth - 120,
           align: "center"
         });
    }

    
    doc.moveTo(120, nameY + 60)
       .lineTo(whiteWidth - 60, nameY + 60)
       .lineWidth(2)
       .strokeColor("#D4AF37")
       .stroke();

   
    doc.font("Helvetica")
       .fontSize(16)
       .fillColor("#34495E")
       .text(`This certificate is presented to ${user.name} who has successfully`, 60, nameY + 90, {
         width: whiteWidth - 120,
         align: "center"
       })
       .text("completed the course", 60, nameY + 115, { 
         width: whiteWidth - 120, 
         align: "center" 
       });

   
    doc.font("Times-Bold")
       .fontSize(26)
       .fillColor("#E67E22")
       .text(course.title.toUpperCase(), 60, nameY + 160, {
         width: whiteWidth - 120,
         align: "center"
       });


    const logoSize = 80;
    const logoX = whiteWidth * 0.5 - logoSize / 2;
    const logoY = nameY + 220;

   
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 10)
       .fill("#D4AF37");
    
    
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 5)
       .fill("#F1C40F");

   
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 * Math.PI) / 180;
      const x1 = logoX + logoSize / 2 + Math.cos(angle) * (logoSize / 2 + 8);
      const y1 = logoY + logoSize / 2 + Math.sin(angle) * (logoSize / 2 + 8);
      const x2 = logoX + logoSize / 2 + Math.cos(angle) * (logoSize / 2 + 12);
      const y2 = logoY + logoSize / 2 + Math.sin(angle) * (logoSize / 2 + 12);
      doc.moveTo(x1, y1)
         .lineTo(x2, y2)
         .lineWidth(2)
         .strokeColor("#D4AF37")
         .stroke();
    }

    
    doc.font("Times-Bold")
       .fontSize(24)
       .fillColor("#D4AF37")
       .text("★", logoX + logoSize / 2 - 8, logoY + logoSize / 2 - 12);

    
    const bottomY = height - 120;
    doc.font("Helvetica")
       .fontSize(12)
       .fillColor("#7F8C8D")
       .text("CERTIFICATE ID:", 80, bottomY, { width: 150 })
       .text("AUTHORIZED BY:", whiteWidth * 0.5, bottomY, { width: 150 });

    doc.font("Helvetica-Bold")
       .fontSize(10)
       .fillColor("#2C3E50")
       .text(certificateId.substring(0, 8).toUpperCase(), 80, bottomY + 20)
       .text(issuedById || "SYSTEM", whiteWidth * 0.5, bottomY + 20);

   
    if (collegese_lms_id) {
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor("#7F8C8D")
         .text("COLLEGE LMS ID:", 80, bottomY + 40, { width: 150 });
      
      doc.font("Helvetica-Bold")
         .fontSize(10)
         .fillColor("#2C3E50")
         .text(collegese_lms_id, 80, bottomY + 60);
    }

  
    doc.font("Helvetica")
       .fontSize(10)
       .fillColor("#7F8C8D")
       .text(`Issued on: ${new Date().toLocaleDateString('en-US', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       })}`, 80, bottomY + (collegese_lms_id ? 80 : 40));

   
    const qrSize = 60;
    const qrX = width - qrSize - 40;
    const qrY = height / 2 - qrSize / 2;

   
    doc.rect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10)
       .fill("white");
    
    
    doc.image(qrCodeDataUrl, qrX, qrY, { width: qrSize });

   
    doc.font("Helvetica")
       .fontSize(8)
       .fillColor("white")
       .text("Verify Certificate", qrX - 10, qrY + qrSize + 10, {
         width: qrSize + 20,
         align: "center"
       });

    doc.end();

    
    await new Promise<void>((resolve) => doc.on("end", resolve));
    const pdfBufferData = pdfBuffer.getContents();

    if (!pdfBufferData) {
      return res.status(500).json({ error: "Failed to generate certificate buffer" });
    }

   
    const s3Key = `certificates/${certificateId}.pdf`;
    await uploadPrivateFileToS3(pdfBufferData, "application/pdf", s3Key);
    const downloadUrl = await generatePresignedDownloadUrl(s3Key, 86400);

    
    const certificateData: any = {
      title: `Certificate - ${course.title}`,
      certificateUrl: s3Key,
      user: { connect: { id: userId } },
      course: { connect: { id: courseId } },
     
    };

    if (issuedById) {
      certificateData.issuedBy = { connect: { id: issuedById } };
    }

    const certificate = await prisma.certificate.create({
      data: certificateData,
    });

    // Send email notification if user has email
    if (user.email) {
      await sendCertificateEmail(user.email, user.name, course.title, downloadUrl);
    }

    res.status(201).json({ 
      message: "Certificate generated and email sent", 
      certificate, 
      downloadUrl 
    });
  } catch (error: any) {
    console.error("Certificate generation failed:", error);
    res.status(500).json({ error: error.message });
  }
};

export const verifyCertificate = async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;

    if (!certificateId) {
      return res.status(400).json({ error: "Certificate ID is required" });
    }

  
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: true,
        issuedBy: true,
        course: true,
      } as unknown as any, 
    }) as {
      id: string;
      title?: string;
      certificateUrl?: string;
      issuedAt: Date;
      user: { id: string; name: string; email: string; collegese_lms_id?: string };
      issuedBy: { id: string; name: string; email: string } | null;
      course: { id: string; title: string };
    } | null;

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found or invalid" });
    }

   
    const { downloadUrl } = await generateVerifiedCertificate(
      certificate.user,
      certificate.course,
      certificate.id
    );

    await sendCertificateVerificationEmail(
      certificate.user.email,
      certificate.user.name,
      certificate.course.title,
      certificate.id,
      downloadUrl
    );

   
    return res.json({
      valid: true,
      certificate: {
        ...certificate,
        issuedBy: certificate.issuedBy
          ? {
              id: certificate.issuedBy.id,
              name: certificate.issuedBy.name,
              email: certificate.issuedBy.email,
            }
          : null,
      },
      verifiedCertificateUrl: downloadUrl,
    });
  } catch (error: any) {
    console.error("Error verifying certificate:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

export const getUserCertificates = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId parameter is required" });

const certificates = await prisma.certificate.findMany({
  where: { userId: userId } as any, 
  include: {
    user: { select: { id: true, name: true, email: true, collegese_lms_id: true } },
    course: true,
    issuedBy: true,
  } as unknown as Prisma.CertificateInclude,
});





    res.json(certificates);
  } catch (error: any) {
    console.error("Error fetching user certificates:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getCertificateById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Certificate ID is required" });

    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        user: true,
        course: true,
        issuedBy: true,
      } as unknown as Prisma.CertificateInclude,
    });

    if (!certificate) return res.status(404).json({ error: "Certificate not found" });

    let downloadUrl: string | undefined;
    if (certificate.certificateUrl) {
      try {
        const s3Key = certificate.certificateUrl;
        downloadUrl = await generatePresignedDownloadUrl(s3Key);
      } catch (error) {
        console.error("Error generating presigned URL:", error);
      }
    }

    res.json({
      ...certificate,
      downloadUrl,
    });
  } catch (error: any) {
    console.error("Error fetching certificate:", error);
    res.status(500).json({ error: error.message });
  }
};

export const revokeCertificate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Certificate ID is required" });

    const certificate = await prisma.certificate.findUnique({ where: { id } });
    if (!certificate) return res.status(404).json({ error: "Certificate not found" });

    await prisma.certificate.delete({ where: { id } });
    res.json({ message: "Certificate revoked successfully" });
  } catch (error: any) {
    console.error("Error revoking certificate:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllCertificates = async (req: Request, res: Response) => {
  try {
 const certificates = await prisma.certificate.findMany({
  include: {
    user: true,
    course: true,
    issuedBy: true,
  } as unknown as Prisma.CertificateInclude,
  orderBy: { issuedAt: 'desc' } as unknown as Prisma.CertificateOrderByWithRelationInput,
});

    res.json(certificates);
  } catch (error: any) {
    console.error("Error fetching all certificates:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllUsersCoursesWithProgress = async (req: Request, res: Response) => {
  try {
    const enrollments = await prisma.courseEnrollment.findMany({
  include: {
    user: { select: { id: true, name: true, email: true } },
    course: {
      select: {
        id: true,
        title: true,
        description: true,
        recordedLectures: { select: { id: true } },
        quizzes: { select: { id: true } },
      } as unknown as Prisma.CourseSelect,
    },
  },
});


    if (!enrollments.length) return res.json([]);

    const allLectureProgress = await prisma.lectureProgress.findMany({ where: { completed: true } });
    const allQuizSubmissions = await prisma.quizSubmission.findMany();

    const coursesWithProgress = enrollments
  .filter(e => e.course && e.user)
  .map(enrollment => {
    const course = enrollment.course as (typeof enrollment.course & {
      recordedLectures: { id: string }[];
      quizzes: { id: string }[];
    });
    const user = enrollment.user;

    const totalLectures = course.recordedLectures.length;
    const totalQuizzes = course.quizzes.length;
    const totalItems = totalLectures + totalQuizzes;

    const completedLecturesCount = course.recordedLectures.filter(rl =>
      allLectureProgress.some((lp: { recordedLectureId: { toString: () => string; }; userId: string; }) => lp.recordedLectureId.toString() === rl.id.toString() && lp.userId === user.id)
    ).length;

    const submittedQuizzesCount = course.quizzes.filter(q =>
      allQuizSubmissions.some((qs: { quizId: { toString: () => string; }; userId: string; }) => qs.quizId.toString() === q.id.toString() && qs.userId === user.id)
    ).length;

    const progress = totalItems > 0
      ? ((completedLecturesCount + submittedQuizzesCount) / totalItems) * 100
      : 0;

    const { recordedLectures, quizzes, ...courseData } = course;

    return {
      ...courseData,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      enrollmentId: enrollment.id,
      progress: parseFloat(progress.toFixed(2)),
      completedLectures: completedLecturesCount,
      submittedQuizzes: submittedQuizzesCount,
      totalLectures,
      totalQuizzes
    };
  });


    res.json(coursesWithProgress);
  } catch (error: any) {
    console.error("Error fetching all users courses with progress:", error);
    res.status(500).json({ error: "Failed to calculate courses progress for all users." });
  }
};


