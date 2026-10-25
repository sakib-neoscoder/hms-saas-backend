CREATE TYPE "public"."appointment_status" AS ENUM('BOOKED', 'PRESENT_IN_CHAMBER', 'VITALS_DONE', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('ONLINE', 'WALK_IN', 'ON_CALL');--> statement-breakpoint
CREATE TYPE "public"."clinic_member_role" AS ENUM('SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT', 'LAB_TECH');--> statement-breakpoint
CREATE TYPE "public"."day_of_week" AS ENUM('SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('CONSULTATION', 'LAB_TEST');--> statement-breakpoint
CREATE TYPE "public"."lab_report_status" AS ENUM('SAMPLE_COLLECTED', 'PROCESSING', 'READY', 'DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BKASH', 'NAGAD', 'SSLCOMMERZ', 'POS_CARD');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."schedule_exception_status" AS ENUM('CANCELLED', 'DELAYED');--> statement-breakpoint
CREATE TYPE "public"."shift_name" AS ENUM('MORNING', 'EVENING');--> statement-breakpoint
CREATE TYPE "public"."visit_type" AS ENUM('NEW', 'FOLLOW_UP', 'REPORT_SHOW');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(15) NOT NULL,
	"email" varchar(255),
	"password_hash" text,
	"full_name" varchar(150) NOT NULL,
	"avatar_r2_key" text,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clinic_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "clinic_member_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_bn" varchar(200),
	"slug" varchar(100) NOT NULL,
	"logo_r2_key" text,
	"phone" varchar(20) NOT NULL,
	"address" text NOT NULL,
	"district" varchar(50) NOT NULL,
	"upazila" varchar(50),
	"dghs_reg_no" varchar(100),
	"sms_sender_id" varchar(20),
	"sms_balance" integer DEFAULT 0 NOT NULL,
	"subscription_plan" varchar(50) DEFAULT 'BASIC' NOT NULL,
	"subscription_expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "specialties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_bn" varchar(100) NOT NULL,
	CONSTRAINT "specialties_name_en_unique" UNIQUE("name_en")
);
--> statement-breakpoint
CREATE TABLE "clinic_doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"room_no" varchar(50),
	"new_patient_fee" integer NOT NULL,
	"followup_fee" integer NOT NULL,
	"followup_validity_days" integer DEFAULT 30 NOT NULL,
	"report_show_fee" integer DEFAULT 0 NOT NULL,
	"assistant_user_id" uuid,
	"pad_print_settings" jsonb,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_doctor_id" uuid NOT NULL,
	"exception_date" date NOT NULL,
	"status" "schedule_exception_status" NOT NULL,
	"delayed_start_time" time,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_doctor_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"shift_name" "shift_name" DEFAULT 'EVENING' NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"max_serial_limit" integer DEFAULT 40 NOT NULL,
	"online_booking_limit" integer DEFAULT 15 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bmdc_reg_no" varchar(50) NOT NULL,
	"specialty_id" uuid NOT NULL,
	"degrees" text NOT NULL,
	"designation" varchar(200),
	"rx_header_bn" text,
	"rx_header_en" text,
	"signature_r2_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctors_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "doctors_bmdc_reg_no_unique" UNIQUE("bmdc_reg_no")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_user_id" uuid,
	"patient_code" varchar(30) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"guardian_name" varchar(150),
	"phone" varchar(15) NOT NULL,
	"age_years" integer NOT NULL,
	"age_months" integer DEFAULT 0 NOT NULL,
	"date_of_birth" date,
	"gender" varchar(20) NOT NULL,
	"blood_group" varchar(10),
	"address" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_patient_code_unique" UNIQUE("patient_code")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_date" date NOT NULL,
	"serial_number" integer NOT NULL,
	"visit_type" "visit_type" NOT NULL,
	"booking_source" "booking_source" NOT NULL,
	"status" "appointment_status" NOT NULL,
	"is_vip_or_emergency" boolean DEFAULT false NOT NULL,
	"cancellation_reason" text,
	"booked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_name" varchar(150) NOT NULL,
	"generic_name" varchar(200) NOT NULL,
	"strength" varchar(100) NOT NULL,
	"dosage_form" varchar(50) NOT NULL,
	"manufacturer" varchar(150)
);
--> statement-breakpoint
CREATE TABLE "prescription_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"template_name" varchar(100) NOT NULL,
	"diagnosis" text,
	"medicines_prescribed" jsonb NOT NULL,
	"lab_tests_advised" jsonb,
	"advice_bn" text
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"vitals" jsonb,
	"chief_complaints" jsonb,
	"medical_history" jsonb,
	"on_examination" jsonb,
	"diagnosis" text,
	"medicines_prescribed" jsonb NOT NULL,
	"lab_tests_advised" jsonb,
	"advice_bn" text,
	"next_visit_date" date,
	"pdf_r2_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prescriptions_appointment_id_unique" UNIQUE("appointment_id")
);
--> statement-breakpoint
CREATE TABLE "clinic_lab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"test_code" varchar(30) NOT NULL,
	"test_name" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"price" integer NOT NULL,
	"sample_room_no" varchar(50),
	"delivery_turnaround_hours" integer DEFAULT 24 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"test_id" uuid,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"test_name" varchar(200) NOT NULL,
	"r2_file_key" text,
	"status" "lab_report_status" DEFAULT 'SAMPLE_COLLECTED' NOT NULL,
	"expected_delivery_at" timestamp with time zone,
	"uploaded_by_user_id" uuid,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"referred_by_doctor_id" uuid,
	"invoice_no" varchar(50) NOT NULL,
	"invoice_type" "invoice_type" NOT NULL,
	"items" jsonb NOT NULL,
	"sub_total" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"discount_remarks" varchar(200),
	"net_payable" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"due_amount" integer NOT NULL,
	"payment_status" "payment_status" NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"gateway_trx_id" varchar(100),
	"collected_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinic_members" ADD CONSTRAINT "clinic_members_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_members" ADD CONSTRAINT "clinic_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_doctors" ADD CONSTRAINT "clinic_doctors_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_doctors" ADD CONSTRAINT "clinic_doctors_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_doctors" ADD CONSTRAINT "clinic_doctors_assistant_user_id_users_id_fk" FOREIGN KEY ("assistant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_schedule_exceptions" ADD CONSTRAINT "doctor_schedule_exceptions_clinic_doctor_id_clinic_doctors_id_fk" FOREIGN KEY ("clinic_doctor_id") REFERENCES "public"."clinic_doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_clinic_doctor_id_clinic_doctors_id_fk" FOREIGN KEY ("clinic_doctor_id") REFERENCES "public"."clinic_doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_specialty_id_specialties_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_primary_user_id_users_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_schedule_id_doctor_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."doctor_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booked_by_user_id_users_id_fk" FOREIGN KEY ("booked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_templates" ADD CONSTRAINT "prescription_templates_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_lab_tests" ADD CONSTRAINT "clinic_lab_tests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_test_id_clinic_lab_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."clinic_lab_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_referred_by_doctor_id_doctors_id_fk" FOREIGN KEY ("referred_by_doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_collected_by_user_id_users_id_fk" FOREIGN KEY ("collected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_phone" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clinic_members_clinic_user_role" ON "clinic_members" USING btree ("clinic_id","user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clinic_doctors_clinic_doctor" ON "clinic_doctors" USING btree ("clinic_id","doctor_id");--> statement-breakpoint
CREATE INDEX "idx_patients_phone" ON "patients" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_appointments_clinic_schedule_date_serial" ON "appointments" USING btree ("clinic_id","schedule_id","appointment_date","serial_number");--> statement-breakpoint
CREATE INDEX "idx_appointments_clinic_date" ON "appointments" USING btree ("clinic_id","appointment_date");--> statement-breakpoint
CREATE INDEX "idx_medicines_brand_name" ON "medicines" USING btree ("brand_name");--> statement-breakpoint
CREATE INDEX "idx_medicines_generic_name" ON "medicines" USING btree ("generic_name");