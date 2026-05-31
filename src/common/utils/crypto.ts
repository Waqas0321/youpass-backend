import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import type { PublicUser } from '../types/auth.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function generateOtp(length: number): string {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, '0');
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

export function minutesUntil(target: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 60_000));
}

export function secondsUntil(target: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 1_000));
}

export function computeProfileCompletion(hasPhoto: boolean, hasInstagram: boolean): number {
  let pct = 70;
  if (hasPhoto) pct += 15;
  if (hasInstagram) pct += 15;
  return pct;
}

export function calculateAge(birthdate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
    age -= 1;
  }
  return age;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    countryCode: user.countryCode,
    fullName: user.fullName,
    email: user.email,
    birthdate: user.birthdate.toISOString().split('T')[0]!,
    gender: user.gender,
    instagramUsername: user.instagramUsername,
    profilePhotoUrl: user.profilePhotoUrl,
    category: user.category,
    createdAt: user.createdAt.toISOString(),
  };
}

export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true, data, ...(meta ? { meta } : {}) };
}
