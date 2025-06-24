
"use server";

import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import { admin } from '@/lib/firebaseAdmin';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(email: string, otp: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER ?? '',
      to: email,
      subject: 'FaceLocker Account Activation OTP',
      text: `Your OTP is: ${otp}. Expires in 5 minutes.`,
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>FaceLocker OTP Verification</h2>
        <p>Hello,</p>
        <p>Your One-Time Password (OTP) for FaceLocker is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #007bff;">${otp}</p>
        <p>This OTP is valid for 5 minutes. Please do not share this code with anyone.</p>
        <p>If you did not request this OTP, please ignore this email.</p>
        <hr/>
        <p style="font-size: 0.9em; color: #555;">This is an automated message. Please do not reply directly to this email.</p>
        <p style="font-size: 0.9em; color: #555;">&copy; ${new Date().getFullYear()} FaceLocker. Secure your world.</p>
      </div>
    `,
    });
    console.log(`Email sent to ${email} with OTP: ${otp}`);
  } catch (error: any) {
    console.error('Error sending email:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    throw new Error('Failed to send email. Please check your email address.');
  }
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

interface OtpResponse {
  success: boolean;
  message: string;
  expiresAt: string | null;
}

export async function sendOtpAction(email: string): Promise<OtpResponse> {
  try {
    console.log('sendOtpAction started for:', email);

    if (!email) {
      return { success: false, message: 'Email is required', expiresAt: null };
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return { success: false, message: 'Server configuration error', expiresAt: null };
    }

    const db = admin.firestore(); // ✅ use admin SDK here
    const otpDocRef = db.collection('otps').doc(email);
    const docSnap = await otpDocRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.createdAt) {
        const createdAt = new Date(data.createdAt);
        const timeSinceLastOtp = (Date.now() - createdAt.getTime()) / 1000;
        if (timeSinceLastOtp < 60) {
          return {
            success: false,
            message: 'Please wait 60 seconds before resending OTP',
            expiresAt: data.expiresAt,
          };
        }
      }
    }

    const otp = generateOtp(); // e.g. 6-digit string
    const expiresAt = new Date(Date.now() + 300 * 1000); // 5 minutes

    // Save OTP
    await otpDocRef.set({
      otp,
      email,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    // Send email
    await sendEmail(email, otp);

    return {
      success: true,
      message: `OTP sent to ${email}`,
      expiresAt: expiresAt.toISOString(),
    };

  } catch (error: any) {
    console.error('sendOtpAction error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });

    return {
      success: false,
      message: error.message || 'Failed to send OTP',
      expiresAt: null,
    };
  }
}

interface VerifyOtpResponse {
  success: boolean;
  message: string;
}

export async function verifyOtpAction(email: string, otp: string): Promise<VerifyOtpResponse> {
  try {
    console.log('verifyOtpAction started for:', email);

    if (!email || !otp) {
      return { success: false, message: 'Email and OTP are required' };
    }

    const db = admin.firestore(); // ✅ use Admin SDK here
    const otpDocRef = db.collection('otps').doc(email);
    const docSnap = await otpDocRef.get();

    if (!docSnap.exists) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    const data = docSnap.data();
    const storedOtp = data?.otp;
    const expiresAt = new Date(data?.expiresAt);

    if (new Date() > expiresAt) {
      return { success: false, message: 'OTP has expired' };
    }

    if (storedOtp !== otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    console.log('OTP verified successfully for:', email);
    return { success: true, message: 'OTP verified successfully' };
  } catch (error: any) {
    console.error('verifyOtpAction error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return {
      success: false,
      message: error.message || 'Failed to verify OTP',
    };
  }
}

interface VerifyLockerPasswordResponse {
  success: boolean;
  message: string;
}

export async function verifyLockerPasswordAction(
  uid: string,
  lockerPassword: string
): Promise<VerifyLockerPasswordResponse> {
  try {
    console.log('verifyLockerPasswordAction started for UID:', uid);

    if (!uid || !lockerPassword) {
      return { success: false, message: 'UID and locker password are required' };
    }

    const db = admin.firestore(); // ✅ Use Admin SDK
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return { success: false, message: 'User not found' };
    }

    const data = userDoc.data();
    const storedLockerPassword = data?.lockerPassword;

    const isMatch = await bcrypt.compare(lockerPassword, storedLockerPassword);
    if (!isMatch) {
      return { success: false, message: 'Invalid locker password' };
    }

    return { success: true, message: 'Locker password verified successfully' };
  } catch (error: any) {
    console.error('verifyLockerPasswordAction error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return {
      success: false,
      message: error.message || 'Failed to verify locker password',
    };
  }
}