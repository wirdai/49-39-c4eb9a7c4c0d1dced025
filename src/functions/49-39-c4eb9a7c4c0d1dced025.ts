import { app, InvocationContext } from "@azure/functions";

import * as df from "durable-functions";
import {
  ActivityHandler,
  OrchestrationContext,
  OrchestrationHandler,
} from "durable-functions";
import { Engine, EngineResult } from "json-rules-engine";
// imports comunes
import * as https from "https";
import * as HttpModule from "../utils/HttpModule";


const defineEngine = () => {
    const engine = new Engine();

    engine.addOperator("es", (factValue, jsonValue) => {
        return true;
    });
    engine.addOperator("includes", (factValue, jsonValue) => {
        return Array.isArray(factValue) && factValue.some((value: string) => value.toLocaleLowerCase() === (jsonValue as string).trim().toLocaleLowerCase());
    });

    return engine;
};

/***************************************************************************************************************************/


const runEngine: ActivityHandler = async function (
  input: any,
  context: InvocationContext
): Promise<EngineResult> {
  context.log("Iniciando procesamiento de reglas ----------------------------------------------", input);
  
  const engine = defineEngine();

  const rule0 = {
  "conditions": {
    "all": [
      {
        "any": [
          {
            "all": [
              {
                "fact": "Categoria",
                "operator": "includes",
                "value": "Jira"
              }
            ]
          },
          {
            "all": [
              {
                "fact": "Categoria",
                "operator": "includes",
                "value": "Bitbucket"
              }
            ]
          }
        ]
      },
      {
        "all": []
      }
    ]
  },
  "event": {
    "type": "Rule1",
    "params": {
      "actions": [
        {
          "type": "derivar",
          "params": {
            "to": "Pedro"
          }
        }
      ]
    }
  }
};
engine.addRule(rule0);



  const result = await engine.run(input);
  context.log("Finalizando procesamiento de reglas ----------------------------------------------", result);
  return result;
};

df.app.activity("runEngine", {
  handler: runEngine,
});

const ModelClassification: ActivityHandler = async function (
    input: string,
    context: InvocationContext,
): Promise<String[]> {
    context.log("TypeScript Activity. ModelClassification")
    const nlpEndpoint = "https://api.wholemeaning.com/api/v1/model/tester";
    const nlpToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiI4NEJiRXdrVG02Mm9PQ1Brd24wQ0gxSmJMeDJ2aEFpMSIsIm1vZGVsIjoxMzE0LCJsYW5ndWFnZSI6ImVzIiwiY3VzdG9tZXIiOjYzfQ.NEDfusL945y1rWf7wqOSG1m-HAAAeGqanmSXSzHRpoA"; // Replace with your actual access token
    const requestOptions: https.RequestOptions = {
        method: "POST",
        headers: {
            Authorization: `Bearer ${nlpToken}`,
            "Content-Type": "application/json"
        }
    };
    const postData = JSON.stringify({
        text: input
    });
    const response = await HttpModule.sendHttpRequest(nlpEndpoint, postData, requestOptions);
    context.log("Response from NLP: ------------------------------------" + response.toString());
    const classifications = JSON.parse(response.toString())["classifications"];
    context.log("Classifications: ------------------------------------" + classifications);
    return classifications.flatMap(classif => classif.classes.map(classInfo => classInfo.name.toLowerCase()));
};
df.app.activity("ModelClassification", {
    handler: ModelClassification
});

const derive: ActivityHandler = async function (
  input: any,
  context: InvocationContext
): Promise<string> {
  context.log("Starting derive ----------------------------------------------");
  context.log(input+ "----------------------------------------------");
  return "Derivado";
};

df.app.activity("derive", {
  handler: derive,
});

const durableOrchestrator: OrchestrationHandler = function* (
    context: OrchestrationContext
  ) {
    const outputs = [];
    const msg: any = context.df.getInput();
  context.log("Starting orchestration with input----------------------------------------------", msg);
  
  // Actividades pre engine
  msg.Categoria = yield context.df.callActivity("ModelClassification", msg.text);
  
  context.log("Starting engine processing----------------------------------------------", msg);
  // Ejecucion del engine rules
  const {
      results, // rule results for successful rules
      failureResults, // rule results for failed rules
      events, // array of successful rule events
      failureEvents, // array of failed rule events
      almanac, // Almanac instance representing the run
  } = yield context.df.callActivity("runEngine", msg);
  
  context.log("Engine processing finished----------------------------------------------", events);
  // Verificacion de resultados
  if (events.length > 0) {
      context.log("Se encontro regla exitosa ----------------------------------------------");
      const to = events[0].params.actions[0].params.to;
      yield context.df.callActivity("derive", msg);
  } else {
      context.log("No se encontro regla exitosa ----------------------------------------------");
  }
  
  context.log("Fin de TODO----------------------------------------------");
    /**
     * Fin del codigo generado
     */
  
    return outputs;
  };
  
  df.app.orchestration("startOrchestrator", durableOrchestrator);

export async function serviceBusQueueTrigger(
  message: unknown,
  context: InvocationContext
): Promise<void> {
  context.log("Service bus queue function processed message:------------------------------------", message);
  const client = df.getClient(context);
  const instanceId: string = await client.startNew(
    "startOrchestrator",
    { input: message }
  );
  context.log(`Started orchestration with ID = '${instanceId}'.`);
}
app.serviceBusQueue("orchestrator", {
  connection: "azureQueueConnection",
  queueName: "49-39-c4eb9a7c4c0d1dced025",
  handler: serviceBusQueueTrigger,
  extraInputs: [df.input.durableClient()],
});
