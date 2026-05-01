import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from 'nestjs-pino';
import { appConfig, databaseConfig, jwtConfig, throttleConfig } from './config/app.config';
import { configValidationSchema } from './config/config.schema';
import { DatabaseModule } from './database/database.module';
import { CorrelationIdMiddleware } from './common/interceptors/correlation-id.middleware';
import { AcademicModule } from './modules/academic/academic.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ImportsModule } from './modules/imports/imports.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RolesModule } from './modules/roles/roles.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StudentsModule } from './modules/students/students.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { SpecialtiesModule } from './modules/specialties/specialties.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, throttleConfig],
      validationSchema: configValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // Cache TTL in seconds (e.g., 5 minutes)
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        redact: ['req.headers.authorization'],
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    // Domain modules
    AuditModule,
    UsersModule,
    ProfilesModule,
    RolesModule,
    OrganizationsModule,
    SchoolsModule,
    AuthModule,
    AcademicModule,
    SpecialtiesModule,
    StudentsModule,
    TimetableModule,
    SessionsModule,
    AttendanceModule,
    InvitationsModule,
    ImportsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
