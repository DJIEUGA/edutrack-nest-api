import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { UsersModule } from '@modules/users/users.module';
import { AuthController } from './api/auth.controller';
import { AuthService } from './application/auth.service';
import { JwtStrategy } from './application/jwt.strategy';
import { TokenService } from './application/token.service';
import { RefreshToken } from './domain/refresh-token.entity';
import { RefreshTokenRepository } from './infrastructure/refresh-token.repository';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken]),
    UsersModule,
    ProfilesModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, RefreshTokenRepository],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
