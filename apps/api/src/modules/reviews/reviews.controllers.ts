import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/auth.decorators';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/jwt-auth.guard';
import { ReviewStatus } from '../../generated/prisma/client';
import { CreateReviewDto, ReviewStatusDto, UpdateReviewDto } from './dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('reviews')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a review (verified purchase required, moderated before publish)',
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.sub, dto);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit your own review (returns to moderation)' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.updateOwn(user.sub, id, dto);
  }

  @Get('products/:slug/reviews')
  @Public()
  @ApiOperation({ summary: 'Approved reviews for a product' })
  listForProduct(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviews.listForProduct(slug, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reviews')
  @ApiOperation({ summary: 'Moderation queue' })
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviews.listAll({
      status: status as ReviewStatus | undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Patch('reviews/:id/status')
  @ApiOperation({ summary: 'Approve/reject a review (recomputes product rating)' })
  setStatus(@Param('id') id: string, @Body() dto: ReviewStatusDto) {
    return this.reviews.setStatus(id, dto.status);
  }
}
