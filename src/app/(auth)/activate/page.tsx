// src/app/(auth)/activate/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { OtpInputComponent } from "@/components/OtpInput";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import { sendOtpAction, verifyOtpAction } from "@/app/actions/authActions";
import bcrypt from "bcryptjs";
import Link from "next/link";
interface OtpFormData {
  otp: string;
}

export default function ActivateAccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [pending, setPending] = useState<null | {
    uid: string;
    email: string;
    lockerPassword: string;
    accountNumber: string;
    name: string;
    mobile: string;
    dob: string;
    gender: string;
    address: string;
    createdAt: string;
  }>(null);

  // Timer and expiration (if you still want it)
  const [otpTimer, setOtpTimer] = useState(300);
  const [isOtpExpired, setIsOtpExpired] = useState(false);
  useEffect(() => {
    if (otpTimer <= 0) {
      setIsOtpExpired(true);
      return;
    }
    const iv = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    return () => clearInterval(iv);
  }, [otpTimer]);

  // 1️⃣ On mount: load pendingRegistration & subscribe to auth
  useEffect(() => {
    const raw = sessionStorage.getItem("pendingRegistration");
    if (!raw) {
      toast({ title: "Error", description: "No registration data. Please register again.", variant: "destructive" });
      router.push("/register");
      return;
    }
    const data = JSON.parse(raw);
    setPending(data);

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        toast({ title: "Error", description: "Auth lost. Please register again.", variant: "destructive" });
        router.push("/register");
      } else {
        setUser(u);
      }
    });
    return unsub;
  }, [router, toast]);

  if (!pending) {
    return <div className="text-center p-4">Loading...</div>;
  }

  // 2️⃣ OTP submission: verify then write all data
  const handleOtpSubmit = async ({ otp: enteredOtp }: OtpFormData) => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Verify OTP
      const vr = await verifyOtpAction(pending.email, enteredOtp);
      if (!vr.success) throw new Error(vr.message);

      // Hash locker password
      const hashed = await bcrypt.hash(pending.lockerPassword, 10);

      // Write user profile
      await setDoc(doc(db, "users", pending.uid), {
        accountNumber: pending.accountNumber,
        name: pending.name,
        email: pending.email,
        mobile: pending.mobile,
        dob: pending.dob,
        gender: pending.gender,
        address: pending.address,
        lockerPassword: hashed,
        emailVerified: true,
        createdAt: pending.createdAt,
        verifiedAt: new Date().toISOString(),
      });

      // Cleanup & redirect
      sessionStorage.removeItem("pendingRegistration");
      toast({ title: "Activated!", description: "Welcome aboard!" });
      router.push("/home");
    } catch (err: any) {
      toast({ title: "Activation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // 3️⃣ Resend OTP using server action (client never writes to /otps)
  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const res = await sendOtpAction(pending.email);
      if (!res.success) throw new Error(res.message);
      setOtpTimer(300);
      setIsOtpExpired(false);
      toast({ title: "OTP Sent", description: `Check ${pending.email}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Activate Your Account</h1>
      <p className="text-center mb-2">OTP sent to <strong>{pending.email}</strong></p>
      <p className="text-center mb-4">Expires in: {Math.floor(otpTimer/60)}:{String(otpTimer%60).padStart(2,'0')}</p>

      <OtpInputComponent
        email={pending.email}
        onSubmit={handleOtpSubmit}
        onResendOtp={handleResendOtp}
        isLoading={isLoading}
        isDisabled={isOtpExpired}
      />

      {isOtpExpired && (
        <div className="mt-4 text-center">
          <Button onClick={handleResendOtp} disabled={isLoading}>
            {isLoading ? <LoaderCircle className="animate-spin mr-2"/> : "Resend OTP"}
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Wrong email or want to restart?{" "}
        <Link href="/register" className="text-primary hover:underline">Register again</Link>
      </p>
    </div>
  );
}
