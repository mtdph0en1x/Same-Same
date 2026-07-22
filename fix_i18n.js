const fs = require('fs');

const addModifiers = (file, rush, hardcore, zen) => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/modifiersNone: (.*?),/, 
`modifiersNone: $1,
      rush: '${rush}',
      hardcore: '${hardcore}',
      zen: '${zen}',`);
    fs.writeFileSync(file, content);
};

addModifiers('frontend/src/i18n/en.js', 'Rush', 'Hardcore', 'Zen');
addModifiers('frontend/src/i18n/es.js', 'Rapidez', 'Extremo', 'Zen');
addModifiers('frontend/src/i18n/ru.js', 'Спешка', 'Хардкор', 'Дзен');
addModifiers('frontend/src/i18n/uk.js', 'Поспіх', 'Хардкор', 'Дзен');

console.log('Translations updated.');
