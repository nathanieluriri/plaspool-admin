// Invented shoppers. Every address is @example.com and every phone number sits in
// the 555 block, so nothing here reaches a real person.

export interface Shopper {
  key: string;
  name: string;
  email: string;
  phone: string;
  account: boolean;
  org?: boolean;
  address: {
    line1: string;
    city: string;
    region: string;
    district?: string;
  };
}

const FCT = 'Federal Capital Territory';

export const SHOPPERS: Shopper[] = [
  {
    key: 'chioma',
    name: 'Chioma Eze',
    email: 'chioma.eze@example.com',
    phone: '+234 800 555 0101',
    account: true,
    address: {
      line1: '14 Aminu Kano Crescent',
      city: 'Abuja',
      region: FCT,
      district: 'Wuse II District',
    },
  },
  {
    key: 'tunde',
    name: 'Tunde Bakare',
    email: 'tunde.bakare@example.com',
    phone: '+234 800 555 0102',
    account: true,
    address: { line1: '3 Admiralty Way', city: 'Lekki', region: 'Lagos', district: 'Eti-Osa' },
  },
  {
    key: 'halima',
    name: 'Halima Garba',
    email: 'halima.garba@example.com',
    phone: '+234 800 555 0103',
    account: true,
    address: { line1: '22 Gana Street', city: 'Abuja', region: FCT, district: 'Maitama District' },
  },
  {
    key: 'emeka',
    name: 'Emeka Obi',
    email: 'emeka.obi@example.com',
    phone: '+234 800 555 0104',
    account: true,
    address: {
      line1: '9 Herbert Macaulay Way',
      city: 'Yaba',
      region: 'Lagos',
      district: 'Lagos Mainland',
    },
  },
  {
    key: 'makerspace',
    org: true,
    name: 'Garki Makerspace',
    email: 'orders@garkimakers.example.com',
    phone: '+234 800 555 0105',
    account: true,
    address: { line1: '5 Ahmadu Bello Way', city: 'Abuja', region: FCT, district: 'Garki' },
  },
  {
    key: 'bisi',
    name: 'Bisi Adewale',
    email: 'bisi.adewale@example.com',
    phone: '+234 800 555 0106',
    account: true,
    address: { line1: '41 Ring Road', city: 'Ibadan', region: 'Oyo' },
  },
  {
    key: 'yusuf',
    name: 'Yusuf Danladi',
    email: 'yusuf.danladi@example.com',
    phone: '+234 800 555 0107',
    account: true,
    address: { line1: '7 Constitution Road', city: 'Kaduna', region: 'Kaduna' },
  },
  {
    key: 'adaeze',
    name: 'Adaeze Nnamdi',
    email: 'adaeze.nnamdi@example.com',
    phone: '+234 800 555 0108',
    account: true,
    address: { line1: '18 Ogui Road', city: 'Enugu', region: 'Enugu' },
  },
  {
    key: 'printfarm',
    org: true,
    name: 'Jabi Print Farm',
    email: 'hello@jabiprintfarm.example.com',
    phone: '+234 800 555 0109',
    account: true,
    address: { line1: '2 Obafemi Awolowo Way', city: 'Abuja', region: FCT, district: 'Jabi' },
  },
  {
    key: 'segun',
    name: 'Segun Afolabi',
    email: 'segun.afolabi@example.com',
    phone: '+234 800 555 0110',
    account: true,
    address: { line1: '30 Allen Avenue', city: 'Ikeja', region: 'Lagos', district: 'Ikeja' },
  },
  {
    key: 'amaka',
    name: 'Amaka Okoro',
    email: 'amaka.okoro@example.com',
    phone: '+234 800 555 0111',
    account: true,
    address: { line1: '11 Aba Road', city: 'Port Harcourt', region: 'Rivers' },
  },
  {
    key: 'ibrahim',
    name: 'Ibrahim Sule',
    email: 'ibrahim.sule@example.com',
    phone: '+234 800 555 0112',
    account: false,
    address: { line1: '6 Zaria Road', city: 'Kano', region: 'Kano' },
  },
  {
    key: 'funke',
    name: 'Funke Ojo',
    email: 'funke.ojo@example.com',
    phone: '+234 800 555 0113',
    account: false,
    address: { line1: '25 Adeola Odeku Street', city: 'Victoria Island', region: 'Lagos' },
  },
  {
    key: 'kunle',
    name: 'Kunle Adeyemi',
    email: 'kunle.adeyemi@example.com',
    phone: '+234 800 555 0114',
    account: true,
    address: {
      line1: '8 Aguiyi Ironsi Street',
      city: 'Abuja',
      region: FCT,
      district: 'Maitama District',
    },
  },
  {
    key: 'zara',
    name: 'Zara Abubakar',
    email: 'zara.abubakar@example.com',
    phone: '+234 800 555 0115',
    account: true,
    address: {
      line1: '16 Yakubu Gowon Crescent',
      city: 'Abuja',
      region: FCT,
      district: 'Asokoro District',
    },
  },
  {
    key: 'obinna',
    name: 'Obinna Chukwu',
    email: 'obinna.chukwu@example.com',
    phone: '+234 800 555 0116',
    account: false,
    address: { line1: '4 Okpara Avenue', city: 'Enugu', region: 'Enugu' },
  },
  {
    key: 'school',
    org: true,
    name: 'Utako STEM Club',
    email: 'stemclub@utakoschool.example.com',
    phone: '+234 800 555 0117',
    account: true,
    address: { line1: '12 Obafemi Awolowo Way', city: 'Abuja', region: FCT, district: 'Utako' },
  },
  {
    key: 'dayo',
    name: 'Dayo Fashola',
    email: 'dayo.fashola@example.com',
    phone: '+234 800 555 0118',
    account: true,
    address: {
      line1: '19 Bode Thomas Street',
      city: 'Surulere',
      region: 'Lagos',
      district: 'Surulere',
    },
  },
  {
    key: 'ngozi',
    name: 'Ngozi Umeh',
    email: 'ngozi.umeh@example.com',
    phone: '+234 800 555 0119',
    account: true,
    address: {
      line1: '27 Ademola Adetokunbo Crescent',
      city: 'Abuja',
      region: FCT,
      district: 'Wuse II District',
    },
  },
  {
    key: 'musa',
    name: 'Musa Aliyu',
    email: 'musa.aliyu@example.com',
    phone: '+234 800 555 0120',
    account: false,
    address: {
      line1: '3 Tafawa Balewa Way',
      city: 'Abuja',
      region: FCT,
      district: 'Central Business District',
    },
  },
];

export const byKey = (key: string): Shopper => {
  const found = SHOPPERS.find((s) => s.key === key);
  if (!found) throw new Error(`no shopper ${key}`);
  return found;
};
