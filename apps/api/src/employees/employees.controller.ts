import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeSchema } from './dto/create-employee.dto';
import { UpdateEmployeeSchema } from './dto/update-employee.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@UseGuards(AuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private svc: EmployeesService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('q') q?: string,
    @Query('active') active?: string,
    @Query('take') takeStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const tenantId = req.user.tenantId as string;
    const take = takeStr ? parseInt(takeStr, 10) : undefined;
    const activeBool = typeof active === 'string' ? active === 'true' : undefined;

    return this.svc.list(tenantId, { q, active: activeBool, take, cursor });
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId as string;
    return this.svc.get(tenantId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const tenantId = req.user.tenantId as string;
    const dto = CreateEmployeeSchema.parse(body);
    return this.svc.create(tenantId, dto);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = req.user.tenantId as string;
    const dto = UpdateEmployeeSchema.parse(body);
    return this.svc.update(tenantId, id, dto);
  }

  @Patch(':id/toggle-active')
  async toggleActive(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId as string;
    return this.svc.toggleActive(tenantId, id);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId as string;
    return this.svc.remove(tenantId, id);
  }
}
