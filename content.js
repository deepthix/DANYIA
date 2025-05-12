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
8. Repond directement le commentaire
9. Donne toujours un commentaire
10. Repond toujours dans la langue du post`;

// Fonction pour remplacer les variables dans le prompt
function replaceVariables(prompt, data) {
  return prompt
    .replace(/{{author\.name}}/g, data.author.name || '')
    .replace(/{{author\.title}}/g, data.author.title || '')
    .replace(/{{content}}/g, data.content || '')
    .replace(/{{image}}/g, data.image || '')
    .replace(/{{#if image}}([\s\S]*?){{\/if}}/g, (match, content) => {
      return data.image ? content : '';
    });
}

// Fonction pour télécharger et convertir l'image en base64
async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erreur lors du téléchargement de l\'image:', error);
    return null;
  }
}

// Fonction pour simuler un glisser-déposer de fichier
function simulateFileDrop(editor, file) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer
  });

  editor.dispatchEvent(dropEvent);
}

// Vérifier si nous sommes sur ChatGPT
if (window.location.hostname === "chatgpt.com") {
  // Récupérer les données du post LinkedIn
  chrome.storage.local.get(
    ["linkedinPostData", "sourceWindowId"],
    async (data) => {
      if (data.linkedinPostData) {
        console.log("Données du post LinkedIn reçues:", data.linkedinPostData);

        // Fonction pour vérifier et initialiser l'éditeur
        const checkForEditor = () => {
          const editor = document.querySelector(
            'div[contenteditable="true"].ProseMirror'
          );
          if (editor) {
            clearInterval(editorCheckInterval);
            console.log("Éditeur ChatGPT trouvé");

            // Nettoyer et formater le contenu du post
            const cleanContent = data.linkedinPostData.content
              .replace(/\n+/g, "\n") // Garder les retours à la ligne simples
              .replace(/\s+/g, " ") // Remplacer les espaces multiples par un seul espace
              .trim(); // Supprimer les espaces au début et à la fin

            // Vérifier que les données sont présentes
            console.log("Données nettoyées:", {
              data: data,
              authorName: data.linkedinPostData.author.name,
              authorTitle: data.linkedinPostData.author.title,
              content: cleanContent,
              image: data.linkedinPostData.image,
            });

            // Récupérer le prompt personnalisé
            chrome.storage.sync.get(['customPrompt'], async (result) => {
              const prompt = result.customPrompt || defaultPrompt;
              
              // Remplacer les variables dans le prompt
              const message = replaceVariables(prompt, {
                author: {
                  name: data.linkedinPostData.author.name,
                  title: data.linkedinPostData.author.title
                },
                content: cleanContent,
                image: data.linkedinPostData.image
              });

              console.log("Message final préparé pour ChatGPT:", message);

              // Insérer le message dans l'éditeur
              const editor = document.querySelector(
                'div[contenteditable="true"].ProseMirror'
              );
              editor.innerHTML = `<p>${message}</p>`;

              // Si une image est présente, la télécharger et simuler un glisser-déposer
              if (data.linkedinPostData.image) {
                try {
                  const response = await fetch(data.linkedinPostData.image);
                  const blob = await response.blob();
                  const file = new File([blob], 'linkedin-image.jpg', { type: 'image/jpeg' });
                  
                  // Simuler le glisser-déposer
                  simulateFileDrop(editor, file);
                  console.log('Image glissée-déposée dans l\'éditeur');
                } catch (error) {
                  console.error('Erreur lors du glisser-déposer de l\'image:', error);
                }
              }

              // Déclencher les événements nécessaires
              editor.dispatchEvent(new Event("input", { bubbles: true }));
              editor.dispatchEvent(new Event("change", { bubbles: true }));

              // Placer le curseur à la fin du texte
              const range = document.createRange();
              const selection = window.getSelection();
              range.selectNodeContents(editor);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);

              // Attendre que le bouton submit soit visible
              await new Promise((resolve, reject) => {
                const checkButtonVisibility = () => {
                  const submitButton = document.querySelector("#composer-submit-button");
                  console.log("submitButton", submitButton);
                  
                  if (submitButton) {
                    const parentSpan = submitButton.parentElement;
                    console.log("parentSpan", parentSpan);
                    if (parentSpan && !parentSpan.matches('span[data-state="closed"]')) {
                      clearInterval(interval);
                      resolve();
                    }
                  }
                };

                // Vérifier toutes les 100ms
                const interval = setInterval(checkButtonVisibility, 100);

               
              }).catch(error => {
                console.error('Erreur en attendant le bouton submit:', error);
              });
              

              // Simuler l'appui sur Entrée pour envoyer le message
              setTimeout(() => {
                console.log("Simuler l'appui sur Entrée pour envoyer le message");
               
                editor.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    metaKey: true, // Pour simuler Cmd+Enter
                  })
                );
              }, 100);

              // Attendre la réponse
              const waitForResponse = setInterval( async () => {
                // Vérifier si le bouton de soumission est caché (réponse terminée)
                const submitButton = document.querySelector(
                  "#composer-submit-button"
                );

                
                const responseElement = document.querySelector(
                  'div[data-message-author-role="assistant"]'
                );

                if (responseElement && (submitButton == null || submitButton == undefined)) {

                    console.log("Réponse de ChatGPT trouvée:", responseElement);
                    console.log("submitButton", submitButton);
                    //wait 1 second
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    //merge all responseElement div[data-message-author-role="assistant"] p into one
                    const responseText = Array.from(responseElement.querySelectorAll('p')).map(p => p.textContent).join('\n');
                    console.log("Réponse de ChatGPT trouvée:", responseText);

                  clearInterval(waitForResponse);
                  const response = responseText;
                  console.log("Réponse de ChatGPT trouvée:", response);

                  // Envoyer la réponse au background script
                  chrome.runtime.sendMessage({
                    action: "responseGenerated",
                    response: response,
                  });

                  // Ne pas fermer la fenêtre automatiquement
                  console.log("Réponse envoyée au background script");
                }
              }, 1000);

              return true; // Arrêter l'intervalle
            });
          }
          return false; // Continuer à vérifier
        };

        // Vérifier l'éditeur toutes les 500ms
        const editorCheckInterval = setInterval(() => {
          if (checkForEditor()) {
            clearInterval(editorCheckInterval);
          }
        }, 500);

        // Arrêter la vérification après 30 secondes si l'éditeur n'est pas trouvé
        setTimeout(() => {
          clearInterval(editorCheckInterval);
          console.error("Timeout: Éditeur ChatGPT non trouvé après 30 secondes");
          
          // Envoyer un message d'erreur au background script
          chrome.runtime.sendMessage({
            action: "responseGenerated",
            response: "❌ Sorry, I couldn't generate a response. Please try again.",
            error: true
          });
        }, 30000);
      } else {
        console.error("Aucune donnée de post LinkedIn trouvée");
      }
    }
  );
}
