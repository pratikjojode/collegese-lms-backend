import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import streamBuffers from "stream-buffers";
import { generatePresignedDownloadUrl, uploadPrivateFileToS3 } from "./s3.utils";


export const generateVerifiedCertificate = async (
  user: any,
  course: any,
  certificateId: string
): Promise<{ s3Key: string; downloadUrl: string }> => {
  const verifyUrl = `${process.env.APP_URL}/verify/${certificateId}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const pdfBuffer = new streamBuffers.WritableStreamBuffer();
  doc.pipe(pdfBuffer);

  doc.save();
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
    .lineWidth(3)
    .strokeColor("#10B981")
    .dash(6, { space: 4 })
    .stroke();
  doc.restore();

  const logoEnv = process.env.COLLEGESE_LOGO_URL!;
  const logoBuffer = Buffer.from(logoEnv.split(",")[1], "base64");
  doc.image(logoBuffer, doc.page.width / 2 - 40, 40, { width: 80 });

  doc.font("Times-Bold")
    .fontSize(34)
    .fillColor("#10B981")
    .text("Verified Certificate", 0, 140, { align: "center" });

  doc.moveDown(1.2);

  doc.fontSize(20).fillColor("#10B981")
    .text("✅ CERTIFIED & VERIFIED", { align: "center" });
  doc.moveDown(1);

  doc.font("Times-Bold")
    .fontSize(26)
    .fillColor("#000")
    .text(user.name, { align: "center", underline: true });

  doc.moveDown(0.6);

  doc.font("Helvetica")
   .fontSize(15)
   .fillColor("#444")
   .text(`LMS ID: ${user.collegese_lms_id || "N/A"}`, { align: "center" });


  doc.moveDown(1);

  doc.font("Helvetica")
    .fontSize(16)
    .fillColor("#222")
    .text("Successfully verified for the course", { align: "center" });
  doc.moveDown(0.6);

  doc.font("Times-Bold")
    .fontSize(22)
    .fillColor("#10B981")
    .text(course.title, { align: "center", underline: true });

  doc.moveDown(1);

  doc.font("Helvetica")
    .fontSize(12)
    .fillColor("#333")
    .text(`Certificate ID: ${certificateId}`, { align: "center" });
  doc.moveDown(0.4);

  doc.image(qrCodeDataUrl, doc.page.width / 2 - 35, doc.y, { width: 70 });

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));

  const pdfBufferData = pdfBuffer.getContents();
  if (!pdfBufferData) throw new Error("Failed to generate verified certificate");

  const s3Key = `certificates/verified_${certificateId}.pdf`;
  await uploadPrivateFileToS3(pdfBufferData, "application/pdf", s3Key);
  const downloadUrl = await generatePresignedDownloadUrl(s3Key, 3600);

  return { s3Key, downloadUrl };
};
