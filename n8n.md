{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const meta = $('3. Compute File Metadata1').item.json;\nconst driveNode = items[0].json || {};\nconst main = (meta.mime_type || '').split('/')[0];\nlet file_type = ['image','video','audio'].includes(main) ? main\n              : (meta.mime_type||'').startsWith('application/') ? 'document'\n              : 'file';\n\nreturn [{\n  json: {\n    ...driveNode,\n    file_name: meta.file_name,\n    file_size: meta.file_size,\n    mime_type: meta.mime_type,\n    file_type\n  }\n}];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -512,
        -2208
      ],
      "id": "b08b627e-3963-40f6-87f2-ba595c7572c0",
      "name": "5B. Prepare Session Data"
    },
    {
      "parameters": {
        "jsCode": "const urlRegex = /(https?:\\/\\/[^\\s<>\"']+)/gi;\nconst imageExtension = /\\.(png|jpe?g|webp|gif|bmp|tiff)(\\?.*)?$/i;\n\nfunction cloneJson(input) {\n  if (input && typeof input === 'object') {\n    return JSON.parse(JSON.stringify(input));\n  }\n  return { raw_original: input ?? null };\n}\n\nfunction extractText(source) {\n  if (typeof source === 'string') return source;\n  if (source && typeof source === 'object') {\n    const preferredKeys = ['text', 'value', 'respuesta', 'output.respuesta', 'message'];\n    for (const key of preferredKeys) {\n      if (typeof source[key] === 'string') return source[key];\n    }\n    const firstString = Object.values(source).find((val) => typeof val === 'string');\n    if (firstString) return firstString;\n  }\n  return '';\n}\n\nconst processed = items.map((item) => {\n  const clone = cloneJson(item.json);\n  const text = extractText(clone);\n  let imageUrl = null;\n  let textClean = text;\n\n  if (typeof text === 'string' && text) {\n    const matches = text.match(urlRegex) ?? [];\n    for (const candidate of matches) {\n      const normalized = candidate.replace(/[),.;]+$/, '');\n      if (imageExtension.test(normalized)) {\n        imageUrl = normalized;\n        break;\n      }\n    }\n    if (imageUrl) {\n      textClean = text.replace(imageUrl, '').trim();\n    }\n  }\n\n  return {\n    ...item,\n    json: {\n      ...clone,\n      text_clean: textClean ?? '',\n      image_url: imageUrl ?? null,\n      is_image_candidate: Boolean(imageUrl),\n    },\n  };\n});\n\nreturn processed;"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1584,
        -2160
      ],
      "id": "8fd94f7d-0315-4537-a195-56db73143f0c",
      "name": "1. Extract Image URL1"
    },
    {
      "parameters": {
        "url": "={{$json.image_url}}",
        "options": {
          "response": {
            "response": {
              "responseFormat": "file"
            }
          }
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        -1360,
        -2160
      ],
      "id": "d52e4b6f-69b5-4b5e-bd9b-7f50b783f840",
      "name": "2. Download Image1"
    },
    {
      "parameters": {
        "jsCode": "const bin = $('2. Download Image1').item.binary?.data;\nif (!bin) throw new Error('No hay binario en 2. Download Image1');\n\nconst base64 = bin.data;\nconst buf = Buffer.from(base64, 'base64');\n\nreturn [{\n  json: {\n    file_name: bin.fileName || 'archivo',\n    file_size: buf.length,         // <-- bytes reales\n    mime_type: bin.mimeType || 'application/octet-stream'\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1152,
        -2160
      ],
      "id": "9e78c55d-ecfe-496f-8b02-9e529a08bc7d",
      "name": "3. Compute File Metadata1"
    },
    {
      "parameters": {
        "url": "https://jdgclasesupb.amocrm.com/api/v4/account?with=drive_url",
        "authentication": "genericCredentialType",
        "genericAuthType": "oAuth2Api",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "with",
              "value": "drive_url"
            }
          ]
        },
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Accept",
              "value": "application/json"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        -912,
        -2160
      ],
      "id": "d46ca9c3-e367-4302-b9b1-1fa4d9e75ac0",
      "name": "4. Get Account Info1",
      "credentials": {
        "oAuth2Api": {
          "id": "Lp0BnZLkCdEAEOLn",
          "name": "Unnamed credential"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "function safeParse(v) {\n  if (typeof v === 'string') { try { return JSON.parse(v); } catch(e) {} }\n  return v ?? {};\n}\n\nfunction firstString(...vals) {\n  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();\n  return null;\n}\n\nreturn items.map((item) => {\n  const j = item.json ?? {};\n  const dataObj = safeParse(j.data);\n  const arr0 = Array.isArray(j) ? j[0] : (Array.isArray(j.data) ? j.data[0] : null);\n\n  const rawDrive =\n    firstString(\n      j.drive_url_fixed,\n      j.drive_url,\n      j._embedded?.account?.drive_url,\n      dataObj?.drive_url,\n      arr0?.drive_url\n    );\n\n  if (!rawDrive) {\n    throw new Error('drive_url no encontrado');\n  }\n\n  const drive_url_fixed = rawDrive.replace('.amocrm.com', '.kommo.com');\n  const drive_api_base = `${drive_url_fixed}/v1.0`;\n\n  return {\n    json: {\n      ...j,\n      drive_url_original: rawDrive,\n      drive_url_fixed,\n      drive_api_base\n    }\n  };\n});"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -704,
        -2160
      ],
      "id": "709d60c2-64ef-4079-92c9-ef64487109f9",
      "name": "5. Parse Drive URL1"
    },
    {
      "parameters": {
        "jsCode": "// CORRECCIÓN: Apunta al nombre correcto del nodo que crea la sesión\nconst session = $('6. Create Upload Session1').item.json;\nconst binaryItem = $('2. Download Image1').item;\nconst maxPartSize = Number(session.max_part_size) || 131072;\n\nif (!binaryItem.binary || !binaryItem.binary.data) {\n  throw new Error('No se encontraron datos binarios del archivo descargado.');\n}\n\n// Lee el archivo completo desde el nodo de descarga\nconst fullBuffer = await Buffer.from(binaryItem.binary.data.data, 'base64');\nconst totalBytes = fullBuffer.length;\n\nconst chunks = [];\nlet offset = 0;\nlet currentUrl = session.upload_url;\n\nwhile (offset < totalBytes) {\n  const end = Math.min(offset + maxPartSize, totalBytes);\n  const slice = fullBuffer.subarray(offset, end);\n  \n  // Estructura de salida correcta para el siguiente nodo\n  const newItem = {\n    json: {\n      upload_url: currentUrl,\n    },\n    binary: {\n      data: slice\n    }\n  };\n  \n  chunks.push(newItem);\n  offset = end;\n}\n\nreturn chunks;"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -112,
        -2208
      ],
      "id": "07299c67-a873-4d96-974a-05ff18aa72b6",
      "name": "7. Split File into Chunks1"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.upload_url }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/octet-stream"
            }
          ]
        },
        "sendBody": true,
        "contentType": "binaryData",
        "inputDataFieldName": "data",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        80,
        -2208
      ],
      "id": "3c3bedbc-5c0d-43bb-bbcc-835e4c11b927",
      "name": "8. Upload File Chunk1"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json.drive_api_base }}/sessions",
        "authentication": "genericCredentialType",
        "genericAuthType": "oAuth2Api",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"name\": \"{{ $('3. Compute File Metadata1').item.json.file_name }}\",\n  \"size\": \"{{ $('3. Compute File Metadata1').item.json.file_size }}\",\n  \"mime_type\": \"{{ $('3. Compute File Metadata1').item.json.mime_type }}\"\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        -304,
        -2208
      ],
      "id": "9c6cb2da-3f97-45a2-bbbf-5cfe61e07bf2",
      "name": "6. Create Upload Session1",
      "credentials": {
        "oAuth2Api": {
          "id": "Lp0BnZLkCdEAEOLn",
          "name": "Unnamed credential"
        }
      }
    }
  ],
  "connections": {
    "5B. Prepare Session Data": {
      "main": [
        [
          {
            "node": "6. Create Upload Session1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "1. Extract Image URL1": {
      "main": [
        [
          {
            "node": "2. Download Image1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "2. Download Image1": {
      "main": [
        [
          {
            "node": "3. Compute File Metadata1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "3. Compute File Metadata1": {
      "main": [
        [
          {
            "node": "4. Get Account Info1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "4. Get Account Info1": {
      "main": [
        [
          {
            "node": "5. Parse Drive URL1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "5. Parse Drive URL1": {
      "main": [
        [
          {
            "node": "5B. Prepare Session Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "7. Split File into Chunks1": {
      "main": [
        [
          {
            "node": "8. Upload File Chunk1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "6. Create Upload Session1": {
      "main": [
        [
          {
            "node": "7. Split File into Chunks1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "c545bf5b7e4a1b0ec16abea84a414cb781ad4083c713f901171e50f5ad408103"
  }
}