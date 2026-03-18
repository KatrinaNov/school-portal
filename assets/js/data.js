// Expose CONFIG as a real global (needed for non-module runtime and bundlers).
var CONFIG = {
    classes: {
        "0": {
            name: "Общий",
            subjects: {
                minecraft: {
                    name: "Minecraft",
                    path: "data/0/minecraft/"
                }
            }
        },
        "2": {
            name: "2 класс",
            subjects: {
                math: {
                    name: "Математика",
                    path: "data/2/math/"
                },
                belarusian: {
                    name: "Белорусский язык",
                    path: "data/2/belarusian/",
                    showOnlyQuizzes: true
                }
            }
        },
        "6": {
            name: "6 класс",
            subjects: {
                history: {
                    name: "История",
                    path: "data/6/history/"
                },
                historybel: {
                    name: "История Беларуси",
                    path: "data/6/historybel/"
                },
                english: {
                    name: "Английский язык",
                    path: "data/6/english/"
                },
                math: {
                    name: "Математика",
                    path: "data/6/math/"
                }
            }
        }
    }
};

if (typeof window !== "undefined") {
    window.CONFIG = CONFIG;
}
