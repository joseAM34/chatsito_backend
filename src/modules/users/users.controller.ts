import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() currentUser: CurrentUser) {
    return this.usersService.getMe(currentUser);
  }

  @Get()
  async searchUsers(@Query('search') search: string, @CurrentUser() currentUser: CurrentUser) {
    return this.usersService.searchUsers(search || '', currentUser);
  }
}
