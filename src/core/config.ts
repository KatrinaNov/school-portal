export type SubjectConfig = {
  name: string;
  path: string;
  showOnlyQuizzes?: boolean;
};

export type ClassConfig = {
  name: string;
  subjects: Record<string, SubjectConfig>;
};

export type AppConfig = {
  classes: Record<string, ClassConfig>;
};

// Source of truth migrated from `assets/js/data.js`
export const CONFIG: AppConfig = {
  classes: {
    "0": {
      name: "Общий",
      subjects: {
        minecraft: {
          name: "Minecraft",
          path: "data/0/minecraft/",
        },
      },
    },
    "2": {
      name: "2 класс",
      subjects: {
        math: {
          name: "Математика",
          path: "data/2/math/",
        },
        belarusian: {
          name: "Белорусский язык",
          path: "data/2/belarusian/",
          showOnlyQuizzes: true,
        },
      },
    },
    "6": {
      name: "6 класс",
      subjects: {
        history: {
          name: "История",
          path: "data/6/history/",
        },
        historybel: {
          name: "История Беларуси",
          path: "data/6/historybel/",
        },
        english: {
          name: "Английский язык",
          path: "data/6/english/",
        },
        math: {
          name: "Математика",
          path: "data/6/math/",
        },
      },
    },
  },
};

