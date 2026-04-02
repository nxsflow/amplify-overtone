import type { ResultPromise } from "execa";

export enum ActionType {
    SEND_INPUT_TO_PROCESS,
    UPDATE_FILE_CONTENT,
    ASSERT_ON_PROCESS_OUTPUT,
    KILL_PROCESS,
}

type SendInputToProcessAction = {
    actionType: ActionType.SEND_INPUT_TO_PROCESS;
    action: (execaProcess: ResultPromise) => Promise<void>;
};

type KillProcess = {
    actionType: ActionType.KILL_PROCESS;
    action: (execaProcess: ResultPromise) => Promise<void>;
};

type UpdateFileContentAction = {
    actionType: ActionType.UPDATE_FILE_CONTENT;
    action: () => Promise<void>;
};

type AssertOnProcessOutputAction = {
    actionType: ActionType.ASSERT_ON_PROCESS_OUTPUT;
    action: (processOutputLine: string) => void;
};

export type Action =
    | SendInputToProcessAction
    | KillProcess
    | UpdateFileContentAction
    | AssertOnProcessOutputAction;

export enum PredicateType {
    MATCHES_STRING_PREDICATE,
}

type MatchesStringPredicate = {
    predicateType: PredicateType.MATCHES_STRING_PREDICATE;
    predicate: (line: string) => boolean;
};

export type Predicate = MatchesStringPredicate;

export type PredicatedAction = {
    ifThis: Predicate;
    then?: Action;
};
