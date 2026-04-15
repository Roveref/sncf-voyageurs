/**
 * Shared utilities for employee ID resolution across grade splits.
 */

export interface EmpLike {
  empId: string;
  _realEmpId?: string;
  [key: string]: any;
}

export const getRealEmpId = (emp: EmpLike): string => emp._realEmpId || emp.empId;

export const getUniqueRealIds = (employees: EmpLike[]): Set<string> => {
  const ids = new Set<string>();
  for (const emp of employees) ids.add(getRealEmpId(emp));
  return ids;
};

export const countUniqueReal = (employees: EmpLike[]): number => getUniqueRealIds(employees).size;
