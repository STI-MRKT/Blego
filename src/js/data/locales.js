import { digits } from '../utils/random.js';

export const LOCALES = {
  BR: {
    name: { ru: 'Бразилия', en: 'Brazil' },
    dial: '+55',
    first: ['Ana', 'Lucas', 'Beatriz', 'Gabriel', 'Camila', 'Rafael', 'Juliana', 'Thiago'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Almeida'],
    cities: [
      { city: 'São Paulo', postal: '01310-100' },
      { city: 'Rio de Janeiro', postal: '22041-011' },
      { city: 'Curitiba', postal: '80010-010' },
      { city: 'Belo Horizonte', postal: '30130-010' }
    ],
    streets: ['Av. Paulista', 'Rua das Flores', 'Av. Atlântica', 'Rua Augusta', 'Av. Brasil', 'Rua Oscar Freire'],
    bio: ['Minha vida, minhas regras ✨', 'Criando coisas bonitas 🌿', 'Café, sol e boas ideias ☀️', 'Menos ruído, mais intenção 🖤'],
    phone: () => `+55 (11) 9${digits(4)}-${digits(4)}`
  },
  US: {
    name: { ru: 'США', en: 'United States' },
    dial: '+1',
    first: ['Emily', 'Michael', 'Olivia', 'Ethan', 'Sophia', 'Daniel', 'Ava', 'Noah'],
    last: ['Carter', 'Bennett', 'Reed', 'Hayes', 'Brooks', 'Foster', 'Morgan', 'Blake'],
    cities: [
      { city: 'San Francisco', postal: '94103' },
      { city: 'Austin', postal: '78701' },
      { city: 'Seattle', postal: '98101' },
      { city: 'Brooklyn', postal: '11201' }
    ],
    streets: ['Market St', 'Oak Avenue', 'Cedar Lane', 'Sunset Blvd', 'Maple Street', 'Pine Court'],
    bio: ['My life my rules! ✨', 'Making things look easy 🌿', 'Coffee first, ideas later ☕', 'Quiet luxury, loud taste 🖤'],
    phone: () => `+1 (415) 555-01${digits(2)}`
  },
  FR: {
    name: { ru: 'Франция', en: 'France' },
    dial: '+33',
    first: ['Camille', 'Louis', 'Léa', 'Hugo', 'Manon', 'Nathan', 'Chloé', 'Théo'],
    last: ['Moreau', 'Lefèvre', 'Bernard', 'Dubois', 'Laurent', 'Girard', 'Rousseau', 'Fontaine'],
    cities: [
      { city: 'Paris', postal: '75011' },
      { city: 'Lyon', postal: '69003' },
      { city: 'Bordeaux', postal: '33000' },
      { city: 'Marseille', postal: '13006' }
    ],
    streets: ['Rue de Rivoli', 'Av. des Champs-Élysées', 'Rue Saint-Denis', 'Bd. Voltaire', 'Rue Oberkampf', 'Rue de Vaugirard'],
    bio: ['Ma vie, mes règles ✨', 'Des idées simples, bien faites 🌿', 'Le détail fait la différence 🖤', 'Calme et création ☕'],
    phone: () => `+33 6 ${digits(2)} ${digits(2)} ${digits(2)} ${digits(2)}`
  },
  PL: {
    name: { ru: 'Польша', en: 'Poland' },
    dial: '+48',
    first: ['Zofia', 'Jakub', 'Maja', 'Szymon', 'Hanna', 'Antoni', 'Lena', 'Kacper'],
    last: ['Kowalski', 'Nowak', 'Wiśniewski', 'Lewandowski', 'Zieliński', 'Kamiński', 'Szymański', 'Wójcik'],
    lastF: ['Kowalska', 'Nowak', 'Wiśniewska', 'Lewandowska', 'Zielińska', 'Kamińska', 'Szymańska', 'Wójcik'],
    female: ['Zofia', 'Maja', 'Hanna', 'Lena'],
    cities: [
      { city: 'Warszawa', postal: '00-950' },
      { city: 'Kraków', postal: '30-001' },
      { city: 'Gdańsk', postal: '80-001' },
      { city: 'Wrocław', postal: '50-001' }
    ],
    streets: ['ul. Marszałkowska', 'ul. Długa', 'ul. Piotrkowska', 'ul. Floriańska', 'ul. Nowy Świat', 'ul. Piękna'],
    bio: ['Moje życie, moje zasady ✨', 'Proste rzeczy, dobrze zrobione 🌿', 'Detal ma znaczenie 🖤', 'Spokój i tworzenie ☕'],
    phone: () => `+48 ${digits(3)} ${digits(3)} ${digits(3)}`
  },
  DE: {
    name: { ru: 'Германия', en: 'Germany' },
    dial: '+49',
    first: ['Lena', 'Lukas', 'Emilia', 'Felix', 'Hannah', 'Jonas', 'Mia', 'Leon', 'Clara', 'Paul'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schäfer'],
    cities: [
      { city: 'Berlin', postal: '10115' },
      { city: 'München', postal: '80331' },
      { city: 'Hamburg', postal: '20095' },
      { city: 'Köln', postal: '50667' },
      { city: 'Frankfurt', postal: '60311' },
      { city: 'Stuttgart', postal: '70173' }
    ],
    streets: ['Unter den Linden', 'Kurfürstendamm', 'Kastanienallee', 'Leopoldstraße', 'Schanzenstraße', 'Königstraße', 'Berger Straße', 'Rheinallee'],
    bio: ['Mein Leben, meine Regeln ✨', 'Schöne Dinge, ehrlich gemacht 🌿', 'Kaffee zuerst, Ideen danach ☕', 'Leiser Luxus, laute Details 🖤', 'Details machen den Unterschied ✨', 'Ruhe und Kreativität 🌿'],
    phone: () => `+49 15${digits(1)} ${digits(4)} ${digits(4)}`
  },
  ES: {
    name: { ru: 'Испания', en: 'Spain' },
    dial: '+34',
    first: ['Lucía', 'Mateo', 'Sofía', 'Hugo', 'Martina', 'Daniel', 'Paula', 'Pablo', 'Alba', 'Adrián'],
    last: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz'],
    cities: [
      { city: 'Madrid', postal: '28001' },
      { city: 'Barcelona', postal: '08001' },
      { city: 'Valencia', postal: '46001' },
      { city: 'Sevilla', postal: '41001' },
      { city: 'Bilbao', postal: '48001' },
      { city: 'Málaga', postal: '29001' }
    ],
    streets: ['Calle de Alcalá', 'Gran Vía', 'Passeig de Gràcia', 'Calle Larios', 'Calle Betis', 'Calle Uría', 'Calle Colón', 'Avenida Diagonal'],
    bio: ['Mi vida, mis reglas ✨', 'Cosas bonitas, bien hechas 🌿', 'Café primero, ideas después ☕', 'Lujo silencioso, gusto alto 🖤', 'El detalle importa ✨', 'Calma y creación 🌿'],
    phone: () => `+34 6${digits(2)} ${digits(3)} ${digits(3)}`
  },
  IT: {
    name: { ru: 'Италия', en: 'Italy' },
    dial: '+39',
    first: ['Giulia', 'Marco', 'Sofia', 'Luca', 'Chiara', 'Matteo', 'Alice', 'Davide', 'Elena', 'Lorenzo'],
    last: ['Rossi', 'Bianchi', 'Romano', 'Ferrari', 'Esposito', 'Ricci', 'Gallo', 'Conti', 'De Luca', 'Greco'],
    cities: [
      { city: 'Milano', postal: '20121' },
      { city: 'Roma', postal: '00184' },
      { city: 'Torino', postal: '10121' },
      { city: 'Firenze', postal: '50122' },
      { city: 'Napoli', postal: '80121' },
      { city: 'Bologna', postal: '40121' }
    ],
    streets: ['Via Roma', 'Corso Buenos Aires', 'Via Dante', 'Lungarno Corsini', 'Via Toledo', 'Via Zamboni', 'Via Garibaldi', 'Corso Vittorio Emanuele'],
    bio: ['La mia vita, le mie regole ✨', 'Cose belle, fatte bene 🌿', 'Prima il caffè, poi le idee ☕', 'Lusso silenzioso, gusto deciso 🖤', 'Il dettaglio fa la differenza ✨', 'Calma e creazione 🌿'],
    phone: () => `+39 3${digits(2)} ${digits(3)} ${digits(4)}`
  },
  GB: {
    name: { ru: 'Великобритания', en: 'United Kingdom' },
    dial: '+44',
    first: ['Olivia', 'Harry', 'Amelia', 'Jack', 'Isla', 'Oliver', 'Freya', 'George', 'Poppy', 'Charlie'],
    last: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright'],
    cities: [
      { city: 'London', postal: 'EC1A 1BB' },
      { city: 'Manchester', postal: 'M1 1AE' },
      { city: 'Birmingham', postal: 'B1 1AA' },
      { city: 'Bristol', postal: 'BS1 4DJ' },
      { city: 'Edinburgh', postal: 'EH1 1YZ' },
      { city: 'Leeds', postal: 'LS1 4AP' }
    ],
    streets: ['High Street', 'Baker Street', 'Oxford Road', "King's Road", 'Deansgate', 'Corn Street', 'Princes Street', 'Briggate'],
    bio: ['My life, my rules ✨', 'Making good things look easy 🌿', 'Coffee first, ideas later ☕', 'Quiet luxury, loud taste 🖤', 'Details matter ✨', 'Calm and creating 🌿'],
    phone: () => `+44 7${digits(3)} ${digits(6)}`
  }
};
