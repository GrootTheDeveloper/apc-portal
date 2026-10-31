-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('PUBLIC', 'CLUB', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('REGISTERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventAttendanceStatus" AS ENUM ('NOT_MARKED', 'PRESENT', 'EXCUSED', 'ABSENT');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "allowGuestRegistration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attendanceFinalizedAt" TIMESTAMP(3),
ADD COLUMN     "attendanceFinalizedById" TEXT,
ADD COLUMN     "audience" "EventAudience" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "onlineUrl" TEXT,
ADD COLUMN     "registrationClosesAt" TIMESTAMP(3),
ADD COLUMN     "registrationOpensAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "guestFullName" TEXT,
    "guestEmail" TEXT,
    "guestStudentId" TEXT,
    "registrationCode" TEXT NOT NULL,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "attendanceStatus" "EventAttendanceStatus" NOT NULL DEFAULT 'NOT_MARKED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_registrationCode_key" ON "event_registrations"("registrationCode");

-- CreateIndex
CREATE INDEX "event_registrations_eventId_status_idx" ON "event_registrations"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_eventId_guestEmail_key" ON "event_registrations"("eventId", "guestEmail");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_eventId_userId_key" ON "event_registrations"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_attendanceFinalizedById_fkey" FOREIGN KEY ("attendanceFinalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
