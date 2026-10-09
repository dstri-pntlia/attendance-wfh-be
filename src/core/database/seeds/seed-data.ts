import { EmployeeStatus } from '../entities/employee.entity.js';

export const DEPARTMENTS = [
  { code: 'ENG', name: 'Engineering' },
  { code: 'HR', name: 'Human Resources' },
  { code: 'FIN', name: 'Finance' },
  { code: 'OPS', name: 'Operations' },
] as const;

export const HR_ADMIN = {
  email: 'hr@example.com',
  password: 'Admin12345',
} as const;

export const DEMO_EMPLOYEE_PASSWORD = 'Employee123';

export interface DemoEmployee {
  employeeNumber: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  departmentCode: (typeof DEPARTMENTS)[number]['code'];
  hireDate: string;
  status: EmployeeStatus;
}

export const DEMO_EMPLOYEES: readonly DemoEmployee[] = [
  {
    employeeNumber: 'EMP-0001',
    fullName: 'Budi Santoso',
    email: 'budi@example.com',
    phone: '081234567801',
    position: 'Backend Engineer',
    departmentCode: 'ENG',
    hireDate: '2024-03-01',
    status: EmployeeStatus.ACTIVE,
  },
  {
    employeeNumber: 'EMP-0002',
    fullName: 'Siti Rahma',
    email: 'siti@example.com',
    phone: '081234567802',
    position: 'Accountant',
    departmentCode: 'FIN',
    hireDate: '2024-05-15',
    status: EmployeeStatus.ACTIVE,
  },
  {
    employeeNumber: 'EMP-0003',
    fullName: 'Agus Wijaya',
    email: 'agus@example.com',
    phone: '081234567803',
    position: 'HR Officer',
    departmentCode: 'HR',
    hireDate: '2023-11-20',
    status: EmployeeStatus.ACTIVE,
  },
  {
    employeeNumber: 'EMP-0004',
    fullName: 'Dewi Lestari',
    email: 'dewi@example.com',
    phone: '081234567804',
    position: 'Operations Coordinator',
    departmentCode: 'OPS',
    hireDate: '2025-01-06',
    status: EmployeeStatus.ACTIVE,
  },
  {
    employeeNumber: 'EMP-0005',
    fullName: 'Rizky Pratama',
    email: 'rizky@example.com',
    phone: '081234567805',
    position: 'Frontend Engineer',
    departmentCode: 'ENG',
    hireDate: '2025-06-02',
    status: EmployeeStatus.ACTIVE,
  },
  {
    employeeNumber: 'EMP-0006',
    fullName: 'Maya Putri',
    email: 'maya@example.com',
    phone: '081234567806',
    position: 'Operations Analyst',
    departmentCode: 'OPS',
    hireDate: '2023-02-13',
    status: EmployeeStatus.INACTIVE,
  },
];
