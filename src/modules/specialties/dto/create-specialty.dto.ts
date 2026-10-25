import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSpecialtyDto {
  @ApiProperty({
    example: 'Cardiology',
    description: 'Medical specialty name in English',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameEn!: string;

  @ApiProperty({
    example: 'কার্ডিওলজি (হৃদরোগ)',
    description: 'Medical specialty name in Bengali',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameBn!: string;
}
