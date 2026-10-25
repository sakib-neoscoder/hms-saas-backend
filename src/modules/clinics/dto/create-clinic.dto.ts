import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateClinicDto {
  @ApiProperty({ example: 'Popular Diagnostic Centre - Dhanmondi', description: 'Clinic name in English' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'পপুলার ডায়াগনস্টিক সেন্টার - ধানমন্ডি', description: 'Clinic name in Bengali' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  nameBn?: string;

  @ApiProperty({
    example: 'popular-dhanmondi',
    description: 'URL-friendly unique slug for subdomain / routing',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase letters, numbers, and single hyphens (e.g. popular-dhanmondi)',
  })
  slug!: string;

  @ApiProperty({ example: '02-9669480', description: 'Reception or hotline contact number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'House 16, Road 2, Dhanmondi, Dhaka', description: 'Detailed clinic address' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: 'Dhaka', description: 'District in Bangladesh' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  district!: string;

  @ApiPropertyOptional({ example: 'Dhanmondi', description: 'Upazila / Thana in Bangladesh' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  upazila?: string;

  @ApiPropertyOptional({ example: 'DGHS-REG-2024-98765', description: 'DGHS License / Registration No' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  dghsRegNo?: string;

  @ApiPropertyOptional({ example: 'POPULAR', description: 'Masking sender ID for BD SMS Gateway' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  smsSenderId?: string;
}
