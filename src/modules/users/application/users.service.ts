import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@common/errors/domain.errors';
import { User } from '../domain/user.entity';
import { UserRepository } from '../infrastructure/user.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User not found', { userId: id });
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  deactivate(id: string): Promise<void> {
    return this.users.setActive(id, false);
  }
}
