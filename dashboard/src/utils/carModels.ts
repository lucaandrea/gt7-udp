// GT7 Car Code to Model Name mapping
// This is a subset of known car codes - add more as needed
export const carCodeToModel: { [key: number]: string } = {
  // Popular GT7 cars
  101: 'Mazda RX-7',
  102: 'Toyota Supra',
  103: 'Nissan GT-R',
  104: 'BMW M3',
  105: 'Porsche 911',
  106: 'Ferrari F40',
  107: 'Lamborghini Huracan',
  108: 'McLaren F1',
  109: 'Ford GT',
  110: 'Chevrolet Corvette',
  // Add more car codes as they are discovered
  // The carCode comes from telemetry data
};

export function getCarModelFromCode(carCode: number): string | null {
  return carCodeToModel[carCode] || null;
}

export function formatCarModel(carCode: number): string {
  const model = getCarModelFromCode(carCode);
  return model || `CAR_${carCode}`;
}