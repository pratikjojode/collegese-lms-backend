import express, { Request, Response } from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import chalk from "chalk";
import cookieParser from 'cookie-parser';
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { connectDatabase, disconnectDatabase } from "./config/db";
import authRouter from "./routes/auth.routes";
import adminRouter from "routes/adminRoutes/admin.routes";
import userRouter from "routes/userRoutes/user.routes";
import liveLectureRoutes from "routes/liveRoutes/liveLecture.routes";
import quizRouter from "./routes/quizRoutes/quiz.routes";
import assessmentRouter from './routes/assessmentRoutes/assessment.routes';
import superAdminRouter from "./routes/superadmin.router";
import { initWebRTCSignaling } from "websocket/signaling";
import recordedLectureRouter from "routes/recordedRoutes/recordedlecture.routes";
import teacherRouter from "routes/teacherRoutes/teacher.routes";
import statsRouter from "routes/statisticsRoutes/stats.routes";
import certificateRouter from "routes/certificate/certificate.route";
import ExamRouter from "routes/examRoutes/exam.routes";
import { notificationRoutes } from "./routes/notification.routes";
import { initCronJobs } from "./utils/cron.utils";
import { maintenanceModeMiddleware } from "middlewares/adminAuth/maintenanceModeMiddleware";
import { authMiddleware } from "middlewares/auth.middleware";
import assistantStatsRouter from "routes/statisticsRoutes/assistantStatsRoutes";


dotenv.config();

const app = express();

const corsOptions = {
    origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.58.1:5173",
        "http://192.168.77.1:5173",
        "http://192.168.0.107:5173",
        "http://192.168.0.106:5173",
        "https://college-lms-frontend.vercel.app",
        "https://your-exact-vercel-domain.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-requested-with"],
    optionsSuccessStatus: 200,
};


app.use(express.json());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.static('public'));

app.get("/", (req, res) => {
    const welcomeMessage = {
        success: true,
        message: "🎓 Welcome to CollegeEse LMS - Where Learning Meets Excellence!",
        team: "NxtHub Team B 🚀",
        developer: "Built with ❤️ by NxtHub Team B",
        version: "v1.0.0",
        timestamp: new Date().toISOString(),
        motto: "Empowering students, one lesson at a time! 📚✨",
        status: "All systems operational and ready to learn! 🚀"
    };
    res.status(200).json(welcomeMessage);
});


app.use('/api/v1/auth', authRouter);


app.use(authMiddleware);
app.use(maintenanceModeMiddleware);


app.use('/api/v1/superadmin', superAdminRouter);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/user', userRouter);
app.use("/api/v1/live-lectures", liveLectureRoutes);
app.use('/api/v1/quizzes', quizRouter);
app.use('/api/v1/reclec', recordedLectureRouter);
app.use('/api/v1/teachers', teacherRouter);
app.use('/api/v1/assessments', assessmentRouter);
app.use('/api/v1/stats', statsRouter);
app.use("/api/v1/certificates", certificateRouter);
app.use("/api/v1/exams", ExamRouter);
app.use("/api/v1/assistant/stats", assistantStatsRouter);



const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new SocketIOServer(server, {
    cors: corsOptions,
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
});

initWebRTCSignaling(io);

const startServer = async () => {
    try {
        await connectDatabase();
        initCronJobs();

        server.listen(PORT, () => {
            console.log(chalk.cyan("=".repeat(60)));
            console.log(chalk.green.bold("🎓 COLLEGESE LMS SERVER") + chalk.white(" - ") + chalk.blue.bold("NxtHub Team B"));
            console.log(chalk.white("❤️  Built with Love by: ") + chalk.red.bold("NxtHub Team B"));
            console.log(chalk.cyan("=".repeat(60)));
            console.log(chalk.white("📡 Server Status: ") + chalk.green.bold("ONLINE"));
            console.log(chalk.white("🌐 Running on: ") + chalk.blue.underline(`http://localhost:${PORT}`));
            console.log(chalk.white("🔌 Socket.IO: ") + chalk.green.bold("ENABLED"));
            console.log(chalk.white("📹 WebRTC Signaling: ") + chalk.green.bold("ENABLED"));
            console.log(chalk.white("⏰ Started at: ") + chalk.magenta(new Date().toLocaleString()));
            console.log(chalk.white("🎯 Environment: ") + chalk.yellow(process.env.NODE_ENV || "development"));
            console.log(chalk.white("🌐 CORS Origins: ") + chalk.cyan(corsOptions.origin.join(", ")));
            console.log(chalk.cyan("=".repeat(60)));
            console.log(chalk.green("✨ NxtHub Team B - Ready to transform education! ✨"));
            console.log(chalk.cyan("=".repeat(60)));
        });
    } catch (error) {
        console.log(chalk.red("❌ Failed to start server:"), error);
        process.exit(1);
    }
};

process.on('SIGINT', async () => {
    console.log(chalk.yellow("\n🔄 Shutting down server..."));
    await disconnectDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(chalk.yellow("\n🔄 Shutting down server..."));
    await disconnectDatabase();
    process.exit(0);
});

startServer();