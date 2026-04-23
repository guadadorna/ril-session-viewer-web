export function isAuthorizedName(name: string): boolean {
  const authorizedNames = process.env.AUTHORIZED_NAMES?.split(",").map((n) =>
    n.trim().toLowerCase()
  ) || [];
  const searchName = name.toLowerCase().trim();

  // Verificar si el nombre o apellido ingresado coincide con alguno autorizado
  return authorizedNames.some((authorized) =>
    searchName.includes(authorized) || authorized.includes(searchName)
  );
}
