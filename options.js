// Prompt par défaut
const defaultPrompt = `Je suis un professionnel qui souhaite commenter ce post LinkedIn. Voici les informations du post :

Post LinkedIn :
Auteur: {{author.name}}
Auteur Tagline: {{author.title}}
Contenu: "{{content}}"
{{#if image}}Image: {{image}}{{/if}}

En tant qu'expert en communication professionnelle, génère un commentaire LinkedIn qui :
1. Est pertinent et ajoute de la valeur à la discussion
2. Reflète une expertise professionnelle
3. Est engageant et encourage l'interaction
4. Reste authentique et naturel
5. Respecte le ton et le style de LinkedIn
6. Ne pas dépasser 2-3 phrases
7. D'après tout se que tu connais de moi

Le commentaire doit être dans la langue du post, professionnel mais chaleureux, et ne pas dépasser 2-3 phrases.`;

// Fonction pour remplacer les variables dans le prompt
function replaceVariables(prompt, data) {
  return prompt
    .replace(/{{author\.name}}/g, data.author.name)
    .replace(/{{author\.title}}/g, data.author.title)
    .replace(/{{content}}/g, data.content)
    .replace(/{{image}}/g, data.image || '')
    .replace(/{{#if image}}([\s\S]*?){{\/if}}/g, (match, content) => {
      return data.image ? content : '';
    });
}

// Charger les options sauvegardées
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['customPrompt'], (result) => {
    const promptTextarea = document.getElementById('prompt');
    promptTextarea.value = result.customPrompt || defaultPrompt;
  });
});

// Sauvegarder les options
document.getElementById('save').addEventListener('click', () => {
  const promptTextarea = document.getElementById('prompt');
  const status = document.getElementById('status');
  
  chrome.storage.sync.set({
    customPrompt: promptTextarea.value
  }, () => {
    status.textContent = 'Options sauvegardées avec succès !';
    status.className = 'status success';
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  });
}); 