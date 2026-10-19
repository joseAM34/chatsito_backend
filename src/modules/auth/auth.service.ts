import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const correoNormalizado = dto.correo.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const usuario = await this.prisma.usuarios.create({
        data: {
          nombre: dto.nombre,
          correo: correoNormalizado,
          password_hash: passwordHash,
        },
      });

      return {
        id_usuario: usuario.id_usuario.toString(),
        nombre: usuario.nombre,
        correo: usuario.correo,
        fecha_registro: usuario.fecha_registro,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const correoNormalizado = dto.correo.toLowerCase().trim();
    const usuario = await this.prisma.usuarios.findFirst({
      where: { correo: correoNormalizado },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValido = await bcrypt.compare(dto.password, usuario.password_hash);

    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: usuario.id_usuario.toString(),
      correo: usuario.correo,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id_usuario: usuario.id_usuario.toString(),
        nombre: usuario.nombre,
        correo: usuario.correo,
      },
    };
  }
}
