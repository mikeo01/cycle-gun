import Gun from "gun/gun";
import "gun/sea";
import { always, compose, ifElse, isNil, not, prop } from "ramda";
import { Stream } from "xstream";
import { adapt } from "@cycle/run/lib/adapt";
const { of: just, createWithMemory } = Stream;
const isMakeUser = (sink, payload) => sink.action === "make-user";
const isSignIn = (sink, payload) => sink.action === "sign-in";
const isSet = (sink, payload) => sink.action === "set";
const isPut = (sink, payload) => sink.action === "put";
const isError = compose(not, isNil, prop("err"));
const defaultPeers = ['https://gun-manhattan.herokuapp.com/gun'];
export const makeGunDriver = (peers = defaultPeers) => (stream$) => {
    const gun = new Gun({ peers });
    const user = gun.user();
    user.recall({ sessionStorage: true }); // remember me token
    const user$ = adapt(createWithMemory().startWith(user));
    const error$ = adapt(createWithMemory());
    const signUp$ = adapt(createWithMemory());
    gun.on("auth", (_) => {
        user$.shamefullySendNext(user);
        error$.shamefullySendNext("");
    });
    stream$.addListener({
        next: sink => {
            if (isMakeUser(sink, sink.payload)) {
                user.create(sink.payload.username, sink.payload.password, ifElse(isError, (error) => error$.shamefullySendNext(error.err), () => signUp$.shamefullySendNext(true)));
            }
            if (isSignIn(sink, sink.payload)) {
                user.auth(sink.payload.username, sink.payload.password, ifElse(isError, (error) => error$.shamefullySendNext(error.err), always(null)));
            }
            if (sink.action === "sign-out") {
                user.leave();
                user$.shamefullySendNext(user);
            }
            if (isSet(sink, sink.payload)) {
                sink.payload.table.set(sink.payload.data);
            }
            if (isPut(sink, sink.payload)) {
                if (sink.payload.id)
                    sink.payload.table.get(sink.payload.id).put(sink.payload.data);
            }
        }
    });
    return {
        user$,
        error$,
        signUp$,
        get: (table) => just(user.get(table))
    };
};
