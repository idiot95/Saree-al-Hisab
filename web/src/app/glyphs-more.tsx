import {
  IconMilk, IconMeat, IconFish, IconEgg, IconBread, IconApple, IconCarrot, IconSalad, IconPizza,
  IconBurger, IconIceCream, IconCake, IconCandy, IconCup, IconTeapot, IconBottle, IconSoup,
  IconCheese, IconChefHat, IconFridge, IconCooker, IconMicrowave,
  IconBed, IconSofa, IconLamp, IconDoor, IconKey, IconLock, IconBath, IconWashMachine, IconIroning,
  IconVacuumCleaner, IconBucket, IconPlant, IconFlower, IconTree, IconSeedling, IconHammer, IconPaint,
  IconBrush, IconAirConditioning,
  IconBolt, IconDroplet, IconFlame, IconPlug, IconBattery, IconAntenna, IconDeviceTv, IconRecharging,
  IconCloud,
  IconBus, IconTrain, IconBike, IconScooter, IconMotorbike, IconMoped, IconParking, IconRoad, IconTruck,
  IconTruckDelivery, IconPackage, IconMail, IconShip,
  IconPill, IconStethoscope, IconDental, IconEyeglass, IconFirstAidKit, IconBuildingHospital,
  IconVaccine, IconRun, IconYoga, IconSwimming, IconCricket, IconBallFootball, IconBallTennis,
  IconSchool, IconBackpack, IconNotebook, IconBooks, IconCertificate, IconChalkboard, IconAbacus,
  IconBabyBottle, IconHorseToy, IconDeviceGamepad, IconTicket, IconMovie, IconPalette, IconHeadphones,
  IconTrophy, IconMedal,
  IconShirt, IconHanger, IconShoe, IconSock, IconNeedleThread, IconPerfume, IconRazor, IconDiamond,
  IconCrown, IconSunglasses,
  IconBuildingMosque, IconMoonStars, IconStar, IconSparkles, IconConfetti, IconBalloon, IconCandle,
  IconPray, IconHeart, IconFriends, IconUsers, IconBuildingCommunity,
  IconCoin, IconCoinRupee, IconPigMoney, IconPercentage, IconDiscount, IconReportMoney,
  IconFileInvoice, IconCalculator, IconScale, IconGavel, IconBriefcase, IconBuilding,
  IconBuildingStore, IconTax, IconAward, IconBuildingFactory,
  IconWorld, IconMap, IconCompass, IconLuggage, IconTent, IconBeach, IconMountain, IconSailboat,
  IconRocket, IconUmbrella, IconSnowflake, IconCloudRain,
  IconCpu, IconKeyboard, IconPrinter, IconDevices, IconDeviceWatch, IconPhoto, IconVideo, IconRadio,
  IconDeviceSpeaker,
  IconDog, IconCat, IconHorse,
  IconTag, type Icon as TablerIcon,
} from '@tabler/icons-react';
import type { MORE_GLYPHS } from './glyph-names';

/* The second, larger set of glyphs — loaded only when a category actually
   wears one of them, or when the picker opens. Every page renders category
   icons, so the base set in Icon.tsx is deliberately small; this one is the
   long tail a household reaches for once it starts filing "Milk" under
   "Groceries" and wants the bottle. Keys match glyph-names.ts exactly. */

const MORE: Record<(typeof MORE_GLYPHS)[number], TablerIcon> = {
  milk: IconMilk, meat: IconMeat, fish: IconFish, egg: IconEgg, bread: IconBread, fruit: IconApple,
  vegetables: IconCarrot, salad: IconSalad, pizza: IconPizza, burger: IconBurger,
  icecream: IconIceCream, cake: IconCake, sweets: IconCandy, tea: IconCup, teapot: IconTeapot,
  bottle: IconBottle, soup: IconSoup, cheese: IconCheese, chef: IconChefHat, fridge: IconFridge,
  cooker: IconCooker, microwave: IconMicrowave,

  bed: IconBed, sofa: IconSofa, lamp: IconLamp, door: IconDoor, key: IconKey, lock: IconLock,
  bath: IconBath, laundry: IconWashMachine, ironing: IconIroning, vacuum: IconVacuumCleaner,
  bucket: IconBucket, plant: IconPlant, flower: IconFlower, tree: IconTree, garden: IconSeedling,
  hammer: IconHammer, paint: IconPaint, brush: IconBrush, aircon: IconAirConditioning,

  electricity: IconBolt, water: IconDroplet, gas: IconFlame, plug: IconPlug, battery: IconBattery,
  dish: IconAntenna, tv: IconDeviceTv, recharge: IconRecharging, cloud: IconCloud,

  bus: IconBus, train: IconTrain, bicycle: IconBike, scooter: IconScooter, motorbike: IconMotorbike,
  moped: IconMoped, parking: IconParking, toll: IconRoad, truck: IconTruck, delivery: IconTruckDelivery,
  package: IconPackage, post: IconMail, ship: IconShip,

  medicine: IconPill, doctor: IconStethoscope, dentist: IconDental, glasses: IconEyeglass,
  firstaid: IconFirstAidKit, hospital: IconBuildingHospital, vaccine: IconVaccine, running: IconRun,
  yoga: IconYoga, swimming: IconSwimming, cricket: IconCricket, football: IconBallFootball,
  tennis: IconBallTennis,

  school: IconSchool, backpack: IconBackpack, notebook: IconNotebook, books: IconBooks,
  certificate: IconCertificate, chalkboard: IconChalkboard, abacus: IconAbacus, baby: IconBabyBottle,
  toys: IconHorseToy, games: IconDeviceGamepad, ticket: IconTicket, cinema: IconMovie, art: IconPalette,
  headphones: IconHeadphones, trophy: IconTrophy, medal: IconMedal,

  shirt: IconShirt, hanger: IconHanger, shoes: IconShoe, socks: IconSock, sewing: IconNeedleThread,
  perfume: IconPerfume, razor: IconRazor, jewellery: IconDiamond, crown: IconCrown,
  sunglasses: IconSunglasses,

  mosque: IconBuildingMosque, moonstars: IconMoonStars, star: IconStar, sparkles: IconSparkles,
  celebration: IconConfetti, balloon: IconBalloon, candle: IconCandle, pray: IconPray, heart: IconHeart,
  friends: IconFriends, people: IconUsers, community: IconBuildingCommunity,

  coin: IconCoin, rupee: IconCoinRupee, piggy: IconPigMoney, percent: IconPercentage,
  discount: IconDiscount, report: IconReportMoney, invoice: IconFileInvoice, calculator: IconCalculator,
  scale: IconScale, gavel: IconGavel, briefcase: IconBriefcase, building: IconBuilding,
  store: IconBuildingStore, tax: IconTax, award: IconAward, factory: IconBuildingFactory,

  world: IconWorld, map: IconMap, compass: IconCompass, luggage: IconLuggage, tent: IconTent,
  beach: IconBeach, mountain: IconMountain, sailboat: IconSailboat, rocket: IconRocket,
  umbrella: IconUmbrella, snowflake: IconSnowflake, rain: IconCloudRain,

  cpu: IconCpu, keyboard: IconKeyboard, printer: IconPrinter, devices: IconDevices, watch: IconDeviceWatch,
  photo: IconPhoto, video: IconVideo, radio: IconRadio, speaker: IconDeviceSpeaker,

  dog: IconDog, cat: IconCat, horse: IconHorse,
};

export default function MoreGlyph({ name, size = 19, strokeWidth = 1.8, ...rest }: {
  name: string; size?: number; strokeWidth?: number;
} & Omit<React.ComponentProps<TablerIcon>, 'name' | 'size' | 'strokeWidth'>) {
  const Glyph = (MORE as Record<string, TablerIcon>)[name] ?? IconTag;
  return <Glyph size={size} stroke={strokeWidth} aria-hidden {...rest} />;
}
