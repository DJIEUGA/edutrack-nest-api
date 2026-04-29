import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './api/profiles.controller';
import { ProfilesService } from './application/profiles.service';
import { Profile } from './domain/profile.entity';
import { ProfileRepository } from './infrastructure/profile.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Profile])],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProfileRepository],
  exports: [ProfilesService],
})
export class ProfilesModule {}
