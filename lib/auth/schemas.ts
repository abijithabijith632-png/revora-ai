import { z } from "zod";
import { passwordPolicy } from "./password";

/**
 * Authentication Zod schemas — single source of truth shared by server
 * route handlers and client forms.
 */

const email = z.string().trim().email("Enter a valid email address.");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required.").max(255),
  email,
  password: passwordPolicy,
  confirmPassword: z.string(),
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name is required.")
    .max(255),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required."),
    password: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(255).optional(),
  jobTitle: z.string().trim().max(128).optional().nullable(),
  avatarUrl: z.string().url().max(512).optional().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
