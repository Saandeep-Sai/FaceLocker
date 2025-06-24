"use server";

import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import nodemailer from 'nodemailer';

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
      from: process.env.SMTP_USER,
      to: email,
      subject: 'FaceLocker Account Activation OTP',
      text: `Your OTP is: ${otp}. Expires in 5 minutes.`,
      html: `<p>Your OTP is: <strong>${otp}</strong>. Expires in 5 minutes.</p>`,
    });
    console.log(`Email sent to ${email} with OTP: ${otp}`);
  } catch (error: any) {
    console.error('Error sending email:', error.message);
    throw new Error('Failed to send email. Please check your email address.');
  }
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtpAction(email: string) {
  try {
    // Dynamically load and initialize Admin SDK
    const adminModule = await import('firebase-admin');
    const admin = adminModule.default || adminModule;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      });
    }
    const firestoreAdmin = admin.firestore();

    // Generate OTP & timestamps
    const otp = generateOtp();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();

    // Rate-limit check in Admin DB
    const ref = firestoreAdmin.collection('otps').doc(email);
    const snap = await ref.get();
    if (snap.exists) {
      const since = (now.getTime() - new Date(snap.data()!.createdAt).getTime()) / 1000;
      if (since < 60) {
        return { success: false, message: 'Please wait before requesting another OTP', expiresAt: snap.data()!.expiresAt };
      }
    }

    // Write via Admin SDK
    await ref.set({ otp, email, createdAt, expiresAt });

    // Send email as before
    await sendEmail(email, otp);

    return { success: true, message: `OTP sent to ${email}`, expiresAt };
  } catch (error: any) {
    console.error('sendOtpAction error:', error.message, error.code);
    return { success: false, message: error.message || 'Failed to send OTP' };
  }
}


export async function verifyOtpAction(email: string, otp: string) {
  try {
    // Dynamically load and initialize Admin SDK
    const adminModule = await import('firebase-admin');
    const admin = adminModule.default || adminModule;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      });
    }
    const firestoreAdmin = admin.firestore();

    // Read via Admin SDK
    const ref = firestoreAdmin.collection('otps').doc(email);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    const data = snap.data()!;
    if (otp !== data.otp) {
      return { success: false, message: 'Invalid OTP' };
    }
    if (new Date() > new Date(data.expiresAt)) {
      return { success: false, message: 'OTP has expired' };
    }

    return { success: true, message: 'OTP verified successfully' };
  } catch (error: any) {
    console.error('verifyOtpAction error:', error.message, error.code);
    return { success: false, message: error.message || 'Failed to verify OTP' };
  }
}
