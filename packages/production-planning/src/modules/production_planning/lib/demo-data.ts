/**
 * Invented example data for a small upholstery and garden-furniture workshop. No real companies, people or prices. Product codes point at the production_bom demo products. dueInWorkingDays counts from the first working day on or after the day the data is (re)created.
 *
 * `rehearsal` is not seeded — it is what the recording does live (see
 * docs/recording/production-planning/plan-nagrania.md); kept here so the plan, the
 * tuning test and the reset script share one set of numbers.
 */
export const demoData = {
  workCenters: [
    {
      code: 'KRO',
      name: 'Krojownia',
      stage: 'cutting',
      dailyCapacityMinutes: 960,
      position: 10,
      notes: '2 osoby × 8 h. Rozkładanie i cięcie tkanin, gąbki na wymiar.'
    },
    {
      code: 'SZW',
      name: 'Szwalnia',
      stage: 'sewing',
      dailyCapacityMinutes: 1920,
      position: 20,
      notes: '4 stanowiska × 8 h.'
    },
    {
      code: 'TAP',
      name: 'Tapicernia — wypełnianie',
      stage: 'upholstery',
      dailyCapacityMinutes: 960,
      position: 30,
      notes: 'Wkładanie gąbki, owata, zamykanie pokrowców.'
    },
    {
      code: 'STO',
      name: 'Stolarnia — montaż',
      stage: 'assembly',
      dailyCapacityMinutes: 960,
      position: 40,
      notes: 'Montaż blatów na stelażach, olejowanie.'
    },
    {
      code: 'PAK',
      name: 'Pakowanie',
      stage: 'packing',
      dailyCapacityMinutes: 720,
      position: 50,
      notes: '1,5 etatu: 8 h + 4 h. Foliowanie, kartony, etykiety.'
    }
  ],
  routings: {
    'PO-45': [
      {
        workCenter: 'KRO',
        minutesPerUnit: 4,
        setupMinutes: 30
      },
      {
        workCenter: 'SZW',
        minutesPerUnit: 9
      },
      {
        workCenter: 'TAP',
        minutesPerUnit: 3
      },
      {
        workCenter: 'PAK',
        minutesPerUnit: 2
      }
    ],
    'PO-120': [
      {
        workCenter: 'KRO',
        minutesPerUnit: 7,
        setupMinutes: 30
      },
      {
        workCenter: 'SZW',
        minutesPerUnit: 18
      },
      {
        workCenter: 'TAP',
        minutesPerUnit: 7
      },
      {
        workCenter: 'PAK',
        minutesPerUnit: 3
      }
    ],
    'PK-50': [
      {
        workCenter: 'KRO',
        minutesPerUnit: 4,
        setupMinutes: 30
      },
      {
        workCenter: 'SZW',
        minutesPerUnit: 8
      },
      {
        workCenter: 'PAK',
        minutesPerUnit: 2
      }
    ],
    'WK-50': [
      {
        workCenter: 'TAP',
        minutesPerUnit: 6
      },
      {
        workCenter: 'PAK',
        minutesPerUnit: 2
      }
    ],
    'ST-120': [
      {
        workCenter: 'STO',
        minutesPerUnit: 80
      },
      {
        workCenter: 'PAK',
        minutesPerUnit: 15
      }
    ]
  },
  orders: [
    {
      product: 'PK-50',
      quantity: 80,
      dueInWorkingDays: 1,
      status: 'in_progress',
      fabric: 'TK-OUT-BEZ',
      reference: 'Sklep internetowy — pokrowce, partia 1'
    },
    {
      product: 'PO-45',
      quantity: 60,
      dueInWorkingDays: 2,
      status: 'in_progress',
      fabric: 'TK-OUT-SZA',
      reference: 'Sklep internetowy — zamówienia z weekendu'
    },
    {
      product: 'PO-120',
      quantity: 40,
      dueInWorkingDays: 3,
      fabric: 'TK-OUT-PAS',
      reference: 'Hotel — meble tarasowe (wycena 118)'
    },
    {
      product: 'ST-120',
      quantity: 8,
      dueInWorkingDays: 3,
      reference: 'Hotel — meble tarasowe (wycena 118)'
    },
    {
      product: 'PK-50',
      quantity: 80,
      dueInWorkingDays: 2,
      fabric: 'TK-OUT-SZA',
      reference: 'Sklep internetowy — pokrowce, partia 2'
    },
    {
      product: 'PK-50',
      quantity: 50,
      dueInWorkingDays: 3,
      fabric: 'TK-OUT-BEZ',
      reference: 'Sklep internetowy — pokrowce, partia 3'
    },
    {
      product: 'PO-45',
      quantity: 120,
      dueInWorkingDays: 4,
      fabric: 'TK-OUT-SZA',
      reference: 'Sieć sklepów ogrodowych — dostawa tygodniowa'
    },
    {
      product: 'PO-120',
      quantity: 35,
      dueInWorkingDays: 5,
      fabric: 'TK-OUT-PAS',
      reference: 'Pensjonat — leżaki i ławki'
    },
    {
      product: 'PK-50',
      quantity: 60,
      dueInWorkingDays: 4,
      fabric: 'TK-OUT-SZA',
      reference: 'Sklep internetowy — pokrowce, partia 4'
    },
    {
      product: 'WK-50',
      quantity: 100,
      dueInWorkingDays: 5,
      reference: 'Wkłady na magazyn'
    },
    {
      product: 'PK-50',
      quantity: 100,
      dueInWorkingDays: 5,
      fabric: 'TK-OUT-BEZ',
      reference: 'Sklep internetowy — pokrowce, partia 5'
    },
    {
      product: 'PO-120',
      quantity: 30,
      dueInWorkingDays: 6,
      fabric: 'TK-OUT-SZA',
      reference: 'Sklep internetowy — ławki'
    },
    {
      product: 'PO-45',
      quantity: 100,
      dueInWorkingDays: 7,
      fabric: 'TK-OUT-BEZ',
      reference: 'Sieć sklepów ogrodowych — dostawa tygodniowa'
    },
    {
      product: 'ST-120',
      quantity: 6,
      dueInWorkingDays: 8,
      reference: 'Restauracja — ogródek letni'
    },
    {
      product: 'PO-120',
      quantity: 40,
      dueInWorkingDays: 8,
      fabric: 'TK-OUT-SZA',
      reference: 'Restauracja — ogródek letni'
    },
    {
      product: 'PO-45',
      quantity: 80,
      dueInWorkingDays: 9,
      fabric: 'TK-OUT-SZA',
      reference: 'Sklep internetowy — zamówienia bieżące'
    }
  ],
  rehearsal: {
    move: {
      product: 'PO-45',
      quantity: 100,
      dueInWorkingDays: 7,
      toWorkingDays: 4
    },
    urgent: {
      product: 'PO-45',
      quantity: 80,
      dueInWorkingDays: 5,
      fabric: 'TK-OUT-SZA',
      reference: 'Pilne — zamówienie z targów ogrodniczych'
    },
    fix: {
      product: 'WK-50',
      quantity: 100,
      dueInWorkingDays: 5,
      toWorkingDays: 8
    }
  }
} as const

export default demoData
