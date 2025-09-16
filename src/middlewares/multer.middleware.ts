import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 500
  }
});

export const uploadExcel = upload.single('excel_file');
export const uploadProfilePic = upload.single('profilePic');
export const uploadCourseThumbnail = upload.single('thumbnail');
export const uploadVideo = upload.single('video');