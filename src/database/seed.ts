import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://clinic_user:clinic_password@localhost:5432/clinic_db';

async function seed() {
  console.log('🌱 Starting Master Database Seeder...');
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    // 1. Seed Super Admin User
    console.log('👤 Seeding System Super Admin user...');
    const superAdminPhone = '01700000000';
    const superAdminPassword = await bcrypt.hash('Admin@1234', 10);

    let [superAdmin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, superAdminPhone))
      .limit(1);

    if (!superAdmin) {
      [superAdmin] = await db
        .insert(schema.users)
        .values({
          phone: superAdminPhone,
          fullName: 'System Super Admin',
          email: 'admin@clinicms.com.bd',
          passwordHash: superAdminPassword,
          isPhoneVerified: true,
          isActive: true,
        })
        .returning();
      console.log(`   ✔ Super Admin created with ID: ${superAdmin.id} (Phone: ${superAdmin.phone})`);
    } else {
      console.log(`   ✔ Super Admin already exists with ID: ${superAdmin.id}`);
    }

    // 2. Seed 12 BD Medical Specialties
    console.log('🏥 Seeding 12 Medical Specialties...');
    const specialtiesList = [
      { nameEn: 'Medicine', nameBn: 'মেডিসিন' },
      { nameEn: 'Cardiology', nameBn: 'কার্ডিওলজি' },
      { nameEn: 'Gynecology & Obstetrics', nameBn: 'স্ত্রীরোগ ও প্রসূতিবিদ্যা' },
      { nameEn: 'Pediatrics', nameBn: 'শিশু রোগ' },
      { nameEn: 'Orthopedics', nameBn: 'অর্থোপেডিকস' },
      { nameEn: 'Dermatology', nameBn: 'চর্ম ও যৌন রোগ' },
      { nameEn: 'ENT (Otolaryngology)', nameBn: 'নাক, কান ও গলা' },
      { nameEn: 'Gastroenterology', nameBn: 'গ্যাস্ট্রোএন্টারোলজি' },
      { nameEn: 'Neurology', nameBn: 'নিউরোমেডিসিন' },
      { nameEn: 'Ophthalmology', nameBn: 'চক্ষু রোগ' },
      { nameEn: 'Urology', nameBn: 'ইউরোলজি' },
      { nameEn: 'Psychiatry', nameBn: 'মনোরোগবিদ্যা' },
    ];

    for (const spec of specialtiesList) {
      await db
        .insert(schema.specialties)
        .values(spec)
        .onConflictDoNothing({ target: schema.specialties.nameEn });
    }
    console.log(`   ✔ Seeded ${specialtiesList.length} medical specialties.`);

    // 3. Seed 20 Common Bangladeshi Medicines
    console.log('💊 Seeding 20 Bangladeshi Medicines...');
    const medicinesList = [
      {
        brandName: 'Napa Extend',
        genericName: 'Paracetamol',
        strength: '665 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Beximco Pharmaceuticals Ltd.',
      },
      {
        brandName: 'Sergel',
        genericName: 'Esomeprazole',
        strength: '20 mg',
        dosageForm: 'Capsule',
        manufacturer: 'Healthcare Pharmaceuticals Ltd.',
      },
      {
        brandName: 'Seclo',
        genericName: 'Omeprazole',
        strength: '20 mg',
        dosageForm: 'Capsule',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Monas',
        genericName: 'Montelukast',
        strength: '10 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Acme Laboratories Ltd.',
      },
      {
        brandName: 'Bizoran',
        genericName: 'Amlodipine + Olmesartan',
        strength: '5/20 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Maxpro',
        genericName: 'Esomeprazole',
        strength: '20 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Ace Plus',
        genericName: 'Paracetamol + Caffeine',
        strength: '500/65 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Ciprocin',
        genericName: 'Ciprofloxacin',
        strength: '500 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Alatrol',
        genericName: 'Cetirizine Dihydrochloride',
        strength: '10 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Fexo',
        genericName: 'Fexofenadine Hydrochloride',
        strength: '120 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Pantonix',
        genericName: 'Pantoprazole',
        strength: '20 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Incepta Pharmaceuticals Ltd.',
      },
      {
        brandName: 'Torax',
        genericName: 'Ketorolac Tromethamine',
        strength: '10 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Filwel Gold',
        genericName: 'Multivitamin & Multimineral A-Z',
        strength: 'Standard',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Calbo-D',
        genericName: 'Calcium Carbonate + Vitamin D3',
        strength: '500 mg / 200 IU',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Losectil',
        genericName: 'Omeprazole',
        strength: '20 mg',
        dosageForm: 'Capsule',
        manufacturer: 'Eskayef Pharmaceuticals Ltd.',
      },
      {
        brandName: 'Bextram Gold',
        genericName: 'Multivitamin with 32 Minerals',
        strength: 'Standard',
        dosageForm: 'Tablet',
        manufacturer: 'Beximco Pharmaceuticals Ltd.',
      },
      {
        brandName: 'Renova',
        genericName: 'Paracetamol',
        strength: '500 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Opsonin Pharma Ltd.',
      },
      {
        brandName: 'Tofen',
        genericName: 'Ketotifen',
        strength: '1 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Beximco Pharmaceuticals Ltd.',
      },
      {
        brandName: 'D-Rise',
        genericName: 'Cholecalciferol (Vitamin D3)',
        strength: '20000 IU',
        dosageForm: 'Capsule',
        manufacturer: 'Square Pharmaceuticals PLC',
      },
      {
        brandName: 'Azithrocin',
        genericName: 'Azithromycin',
        strength: '500 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Popular Pharmaceuticals Ltd.',
      },
    ];

    for (const med of medicinesList) {
      const [existing] = await db
        .select({ id: schema.medicines.id })
        .from(schema.medicines)
        .where(eq(schema.medicines.brandName, med.brandName))
        .limit(1);

      if (!existing) {
        await db.insert(schema.medicines).values(med);
      }
    }
    console.log(`   ✔ Seeded ${medicinesList.length} authentic medicines.`);

    // 4. Seed Demo Sample Clinic & Sample Lab Tests
    console.log('🏢 Seeding Demo Clinic and 5 Sample Lab Tests...');
    const demoClinicSlug = 'dhaka-central';
    let [demoClinic] = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.slug, demoClinicSlug))
      .limit(1);

    if (!demoClinic) {
      [demoClinic] = await db
        .insert(schema.clinics)
        .values({
          name: 'Dhaka Central Diagnostic & Clinic',
          nameBn: 'ঢাকা সেন্ট্রাল ডায়াগনস্টিক অ্যান্ড ক্লিনিক',
          slug: demoClinicSlug,
          phone: '02-9669480',
          address: 'House 12, Road 5, Dhanmondi, Dhaka',
          district: 'Dhaka',
          upazila: 'Dhanmondi',
          dghsRegNo: 'DGHS-DEMO-2024-001',
          smsSenderId: 'CENTRAL',
          smsBalance: 100,
          subscriptionPlan: 'PRO',
          isActive: true, // Super Admin approved sample clinic
        })
        .returning();

      // Assign Super Admin as SUPER_ADMIN of the demo clinic
      await db
        .insert(schema.clinicMembers)
        .values({
          clinicId: demoClinic.id,
          userId: superAdmin.id,
          role: 'SUPER_ADMIN',
          isActive: true,
        })
        .onConflictDoNothing();

      console.log(`   ✔ Created Demo Clinic with ID: ${demoClinic.id}`);
    } else {
      console.log(`   ✔ Demo Clinic exists with ID: ${demoClinic.id}`);
    }

    const sampleLabTests = [
      {
        clinicId: demoClinic.id,
        testCode: 'CBC-01',
        testName: 'Complete Blood Count (CBC) with ESR',
        category: 'Hematology',
        price: 450,
        sampleRoomNo: 'Room 102',
        deliveryTurnaroundHours: 12,
        isActive: true,
      },
      {
        clinicId: demoClinic.id,
        testCode: 'XRAY-01',
        testName: 'Chest X-Ray P/A View',
        category: 'Radiology',
        price: 700,
        sampleRoomNo: 'Room 108',
        deliveryTurnaroundHours: 6,
        isActive: true,
      },
      {
        clinicId: demoClinic.id,
        testCode: 'USG-01',
        testName: 'USG of Whole Abdomen',
        category: 'Ultrasonography',
        price: 1500,
        sampleRoomNo: 'Room 205',
        deliveryTurnaroundHours: 4,
        isActive: true,
      },
      {
        clinicId: demoClinic.id,
        testCode: 'BIO-01',
        testName: 'Serum Creatinine',
        category: 'Biochemistry',
        price: 350,
        sampleRoomNo: 'Room 102',
        deliveryTurnaroundHours: 8,
        isActive: true,
      },
      {
        clinicId: demoClinic.id,
        testCode: 'BIO-02',
        testName: 'Random Blood Sugar (RBS)',
        category: 'Biochemistry',
        price: 150,
        sampleRoomNo: 'Room 102',
        deliveryTurnaroundHours: 2,
        isActive: true,
      },
    ];

    for (const test of sampleLabTests) {
      await db
        .insert(schema.clinicLabTests)
        .values(test)
        .onConflictDoNothing();
    }
    console.log(`   ✔ Seeded ${sampleLabTests.length} sample lab tests for Demo Clinic.`);

    console.log('✅ Master Database Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
