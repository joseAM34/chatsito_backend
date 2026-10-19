import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(currentUser: CurrentUser) {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id_usuario: BigInt(currentUser.id_usuario) },
    });

    if (!usuario) {
      return null;
    }

    return {
      id_usuario: usuario.id_usuario.toString(),
      nombre: usuario.nombre,
      correo: usuario.correo,
      fecha_registro: usuario.fecha_registro,
    };
  }

  async searchUsers(search: string, currentUser: CurrentUser) {
    const usuarios = await this.prisma.usuarios.findMany({
      where: {
        AND: [
          {
            id_usuario: {
              not: BigInt(currentUser.id_usuario),
            },
          },
          {
            OR: [
              {
                nombre: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                correo: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      take: 20,
      select: {
        id_usuario: true,
        nombre: true,
        correo: true,
      },
    });

    return usuarios.map((usuario) => ({
      id_usuario: usuario.id_usuario.toString(),
      nombre: usuario.nombre,
      correo: usuario.correo,
    }));
  }
}
