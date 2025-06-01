"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { registerSchema, type RegisterFormData } from '@/lib/schemas';
import { CalendarIcon, UserPlus, LoaderCircle } from 'lucide-react';
import { format } from "date-fns";
import Link from 'next/link';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { sendOtpAction } from '@/app/actions/authActions';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accountNumber: '',
      name: '',
      email: '',
      mobile: '',
      dob: '',
      gender: 'other',
      address: '',
      password: '',
      lockerPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      console.log('Starting registration for email:', data.email);
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      console.log('User created with UID:', user.uid);

      const hashedLockerPassword = await bcrypt.hash(data.lockerPassword, 10);
      console.log('Locker password hashed');

      await setDoc(doc(db, 'users', user.uid), {
        accountNumber: data.accountNumber,
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        dob: data.dob,
        gender: data.gender || 'other',
        address: data.address,
        lockerPassword: hashedLockerPassword,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });
      console.log('User data stored in Firestore for UID:', user.uid);

      const otpResponse = await sendOtpAction(data.email);
      if (!otpResponse.success) {
        throw new Error(otpResponse.message);
      }
      console.log('OTP sent successfully:', otpResponse.message);

      sessionStorage.setItem('activationEmail', data.email);
      toast({
        title: 'Registration Complete',
        description: 'Please check your email for the OTP to activate your account.',
      });
      router.push('/activate');
    } catch (error: any) {
      let description = 'Registration failed.';
      if (error.message?.includes('Failed to send email')) {
        description = 'Failed to send OTP email. Please check your email address and try again.';
      } else if (error instanceof Error && 'code' in error) {
        const authError = error as any;
        switch (authError.code) {
          case 'auth/email-already-in-use':
            description = 'Email already registered. Log in or reset password.';
            break;
          case 'auth/invalid-email':
            description = 'Invalid email address.';
            break;
          case 'auth/weak-password':
            description = 'Password too weak. Use a stronger password.';
            break;
          default:
            console.error('Auth error:', authError.message, authError.code);
            description = authError.message || description;
        }
      } else {
        console.error('Unexpected error:', error.message, error.code);
        description = error.message || description;
      }
      toast({
        title: 'Registration Failed',
        description,
        variant: 'destructive',
      });
      sessionStorage.removeItem('activationEmail');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1 className="mb-6 text-center text-3xl font-bold tracking-tight text-foreground">Create Account</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="accountNumber">Account Number</FormLabel>
                  <FormControl>
                    <Input id="accountNumber" placeholder="e.g., 96546461" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Full Name</FormLabel>
                  <FormControl>
                    <Input id="name" placeholder="e.g; J" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="email">Email Address</FormLabel>
                  <FormControl>
                    <Input id="email" type="email" placeholder="example@gmail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="mobile">Mobile Number</FormLabel>
                  <FormControl>
                    <Input id="mobile" type="tel" placeholder="e.g., 1234567895" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dob"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel htmlFor="dob">Date of Birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : '')}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="gender">Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="address">Address</FormLabel>
                <FormControl>
                  <Input id="address" placeholder="123 Main St, Anytown" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="password">Password</FormLabel>
                <FormControl>
                  <Input id="password" type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormDescription>Password must be at least 8 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lockerPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="lockerPassword">Locker Password</FormLabel>
                <FormControl>
                  <Input id="lockerPassword" type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormDescription>Set a password for locker access (min 8 characters).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Register
          </Button>
        </form>
      </Form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Login here
        </Link>
      </p>
    </>
  );
}