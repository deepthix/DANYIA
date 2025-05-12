chrome.runtime.onInstalled.addListener(() => {
    chrome.notifications.create('install_notification', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon.png'),
      title: 'Extension installée',
      message: 'Extension installée avec succès !',
      priority: 2,
      requireInteraction: false
    });
    
    chrome.contextMenus.create({
      id: "showBox",
      title: "Comment with DANYIA",
      contexts: ["all"],
      documentUrlPatterns: ["*://*.linkedin.com/*"]
    });
  });
  
  // Écouter les messages du content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message reçu:', request);
    if (request.action === "generateResponse") {
      // Nettoyer les données précédentes
      chrome.storage.local.remove(['linkedinPostData', 'sourceWindowId', 'chatgptWindowId'], () => {
        // Créer une fenêtre popup pour ChatGPT cachée
        chrome.windows.create({
          url: 'https://chatgpt.com/?model=gpt-4o',
          type: 'popup',
          width: 1,
          height: 1,
          left: -9999,
          top: -9999,
          focused: false
        }, (window) => {
          // Stocker les données du post pour les utiliser plus tard  
          chrome.storage.local.set({
            'linkedinPostData': request.postData,
            'sourceWindowId': sender.tab.windowId,
            'chatgptWindowId': window.id
          });

          // Afficher l'animation "in process..." dans l'éditeur LinkedIn
          chrome.tabs.query({ windowId: sender.tab.windowId, active: true }, (tabs) => {
            if (tabs[0]) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (editorId) => {
                  // Nettoyer l'intervalle précédent s'il existe
                  if (window.danyaProcessInterval) {
                    clearInterval(window.danyaProcessInterval);
                    window.danyaProcessInterval = null;
                  }

                  const editorElement = document.getElementById(editorId);
                  if (editorElement) {
                    let dots = 0;
                    const maxDots = 3;
                    const interval = setInterval(() => {
                      dots = (dots + 1) % (maxDots + 1);
                      const dotsStr = '.'.repeat(dots);
                      editorElement.innerHTML = `DANYIA in process${dotsStr}`;
                      editorElement.dispatchEvent(new Event('input', { bubbles: true }));
                    }, 500);

                    // Stocker l'intervalle pour le nettoyer plus tard
                    window.danyaProcessInterval = interval;
                  }
                },
                args: [request.postData.editorId]
              });
            }
          });
        });
      });
      
      return true;
    } else if (request.action === "responseGenerated") {
      // Récupérer l'ID de la fenêtre source et ChatGPT
      chrome.storage.local.get(['linkedinPostData', 'sourceWindowId', 'chatgptWindowId'], (data) => {
        if (data.sourceWindowId && data.linkedinPostData) {
          // Trouver l'onglet LinkedIn actif dans la fenêtre source
          chrome.tabs.query({ windowId: data.sourceWindowId, active: true }, (tabs) => {
            if (tabs[0]) {
              // Insérer la réponse dans l'éditeur LinkedIn
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (response, editorId, isError) => {
                  // Nettoyer l'intervalle d'animation
                  if (window.danyaProcessInterval) {
                    clearInterval(window.danyaProcessInterval);
                    window.danyaProcessInterval = null;
                  }

                  const editorElement = document.getElementById(editorId);
                  if (editorElement) {
                    if (isError) {
                      // Si c'est une erreur, afficher en rouge
                      editorElement.innerHTML = `<span style="color: #dc3545;">${response}</span>`;
                    } else {
                      editorElement.innerHTML = response;
                    }
                    editorElement.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log('Réponse insérée dans LinkedIn:', response);
                  } else {
                    console.error('Éditeur LinkedIn non trouvé');
                  }
                },
                args: [request.response, data.linkedinPostData.editorId, request.error || false]
              });

              // Fermer la fenêtre ChatGPT
              if (data.chatgptWindowId) {
                chrome.windows.remove(data.chatgptWindowId);
              }

              // Nettoyer les données stockées
              chrome.storage.local.remove(['linkedinPostData', 'sourceWindowId', 'chatgptWindowId']);
            }
          });
        }
      });
      return true;
    }
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "showBox") {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Trouver l'éditeur actif
          const activeElement = document.activeElement;
          const editorElement = activeElement.closest('.ql-editor[contenteditable="true"]');
          
          if (editorElement) {
            // Trouver le post le plus proche
            let currentElement = editorElement;
            let postContainer = null;
            
            // Remonter dans l'arbre DOM jusqu'à trouver un post
            while (currentElement && !postContainer) {
              postContainer = currentElement.closest('.feed-shared-update-v2');
              currentElement = currentElement.parentElement;
            }
          
            if (postContainer) {
              // Générer un ID unique pour l'éditeur
              const editorId = 'linkedin-editor-' + Date.now();
              editorElement.id = editorId;

              // Récupérer les informations du post
              const authorNameElement = postContainer.querySelector('.update-components-actor__title .t-bold span[aria-hidden="true"]');
              const authorName = authorNameElement ? authorNameElement.textContent.trim() : '';
              
              const authorTitle = postContainer.querySelector('.update-components-actor__description')?.textContent.trim() || '';
              
              // Récupérer le contenu du post de manière plus précise
              const postTextContainer = postContainer.querySelector('.update-components-text');
              let postText = '';
              
              if (postTextContainer) {
                // Récupérer tous les spans et les liens
                const elements = postTextContainer.querySelectorAll('span, a');
                postText = Array.from(elements)
                  .map(element => {
                    // Si c'est un lien, récupérer son texte
                    if (element.tagName.toLowerCase() === 'a') {
                      return element.textContent.trim();
                    }
                    // Sinon récupérer le texte du span
                    return element.textContent.trim();
                  })
                  .filter(text => text.length > 0)
                  .join('\n');
              }
              
              const postImage = postContainer.querySelector('.update-components-image__image')?.src || '';
              
              // Préparer les données pour l'API
              const postData = {
                author: {
                  name: authorName,
                  title: authorTitle
                },
                content: postText,
                image: postImage,
                editorId: editorId
              };

              // Envoyer les données au background script
              chrome.runtime.sendMessage(
                { action: "generateResponse", postData: postData }
              );
            } else {
              console.log('Post non trouvé près de l\'éditeur');
            }
          } else {
            console.log('Éditeur LinkedIn non trouvé');
          }
        }
      });
    }
  });
  