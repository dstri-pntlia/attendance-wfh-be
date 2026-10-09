import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-code.js';
import { ApiErrorResponses } from '../../common/errors/error-response.dto.js';
import { PhotoUploadInterceptor } from '../../common/interceptors/photo-upload.interceptor.js';
import { ApiPaginatedResponse } from '../../common/pagination/paginated-response.js';
import { ParseIdPipe } from '../../common/pipes/validation.pipe.js';
import { API_PREFIX } from '../../config/app.config.js';
import { UserRole } from '../../core/database/entities/user.entity.js';
import {
  type AuthUser,
  CurrentUser,
  Roles,
} from '../auth/decorators/auth.decorators.js';
import { AttendanceService } from './attendance.service.js';
import {
  AttendanceQueryDto,
  AttendanceResponseDto,
  CheckInDto,
  CheckOutDto,
  MyAttendanceQueryDto,
  PhotoQueryDto,
  TodayAttendanceResponseDto,
} from './dto/attendance.dto.js';

@ApiTags('Attendances')
@ApiBearerAuth()
@ApiErrorResponses(401)
@Controller('attendances')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @Roles(UserRole.EMPLOYEE)
  @UseInterceptors(PhotoUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CheckInDto })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @ApiErrorResponses(400, 403, 409, 413, 415)
  async checkIn(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CheckInDto,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AttendanceResponseDto> {
    if (!photo) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'A check-in photo is required.',
      );
    }

    const attendance = await this.attendanceService.checkIn(actor, {
      photo: photo.buffer,
      originalName: photo.originalname,
      notes: dto.notes,
      clientReportedAt: dto.clientReportedAt,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.location(`/${API_PREFIX}/attendances/${attendance.id}`);
    return attendance;
  }

  @Post('check-out')
  @Roles(UserRole.EMPLOYEE)
  @UseInterceptors(PhotoUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CheckOutDto })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiErrorResponses(403, 409, 413, 415)
  checkOut(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
  ): Promise<AttendanceResponseDto> {
    return this.attendanceService.checkOut(actor, {
      photo: photo?.buffer,
      originalName: photo?.originalname,
    });
  }

  @Get('me/today')
  @Roles(UserRole.EMPLOYEE)
  @ApiOkResponse({ type: TodayAttendanceResponseDto })
  @ApiErrorResponses(403)
  findToday(
    @CurrentUser() actor: AuthUser,
  ): Promise<TodayAttendanceResponseDto> {
    return this.attendanceService.findToday(actor);
  }

  @Get('me')
  @Roles(UserRole.EMPLOYEE)
  @ApiPaginatedResponse(AttendanceResponseDto)
  @ApiErrorResponses(400, 403)
  findMine(
    @CurrentUser() actor: AuthUser,
    @Query() query: MyAttendanceQueryDto,
  ) {
    return this.attendanceService.findMine(actor, query);
  }

  @Get()
  @Roles(UserRole.HR_ADMIN)
  @ApiPaginatedResponse(AttendanceResponseDto)
  @ApiErrorResponses(400, 403)
  findAll(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<AttendanceResponseDto> {
    return this.attendanceService.findOne(id, actor);
  }

  @Get(':id/photo')
  @Header('Cache-Control', 'private, max-age=300')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Attendance photo bytes.' })
  @ApiErrorResponses(400, 404)
  async getPhoto(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Query() query: PhotoQueryDto,
  ): Promise<StreamableFile> {
    const photo = await this.attendanceService.getPhoto(id, actor, query.type);
    return new StreamableFile(photo.stream, {
      type: photo.mimeType,
      length: photo.sizeBytes,
      disposition: 'inline',
    });
  }
}
