
import { PrismaClient } from "../generated/prisma";
import chalk from "chalk";

declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.prisma;
}

export const connectDatabase = async () => {
  try {
    console.log(chalk.cyan("🔄 Attempting to connect to MongoDB..."));
    
    await prisma.$connect();
    
    console.log(chalk.cyan("=" .repeat(60)));
    console.log(
      chalk.white("💾 Database Status: ") + 
      chalk.green.bold("CONNECTED ✅")
    );
    console.log(
      chalk.white("🗄️  Database Type: ") + 
      chalk.blue("MongoDB Atlas")
    );
    console.log(
      chalk.white("🔗 Connection: ") + 
      chalk.green("Established successfully")
    );
    console.log(chalk.cyan("=" .repeat(60)));
    
  } catch (error) {
    console.log(chalk.cyan("=" .repeat(60)));
    console.log(
      chalk.white("💾 Database Status: ") + 
      chalk.red.bold("CONNECTION FAILED ❌")
    );
    console.log(
      chalk.white("❌ Error: ") + 
      chalk.red(error instanceof Error ? error.message : "Unknown error")
    );
    console.log(chalk.cyan("=" .repeat(60)));
    
    console.log(chalk.yellow("⚠️  Server will continue without database connection"));
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log(chalk.yellow("🔌 Database disconnected"));
  } catch (error) {
    console.log(chalk.red("❌ Error disconnecting database:", error));
  }
};

export default prisma;
