import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // 验证输入
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 验证密码强度
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为 6 位' },
        { status: 400 }
      );
    }

    // 检查邮箱是否已存在
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 409 }
      );
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 生成唯一 ID
    const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // 创建用户
    const result = await query(
      'INSERT INTO users (id, email, password_hash, name, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, email, name, created_at',
      [userId, email, passwordHash, name || null]
    );

    const user = result.rows[0];

    return NextResponse.json(
      {
        message: '注册成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `注册失败：${errorMessage}` },
      { status: 500 }
    );
  }
}
