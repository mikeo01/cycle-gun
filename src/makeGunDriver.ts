import Gun, { IGunChain, IGunUserInstance } from "gun";
import "gun/sea";
import { always, compose, ifElse, isNil, not, prop } from "ramda";
import { MemoryStream, Stream } from "xstream";
import { adapt } from "@cycle/run/lib/adapt"

const { of: just, createWithMemory } = Stream;
export const noop = always(undefined)

export interface GunSource {
  user$: Stream<IGunUserInstance>
  error$: Stream<string>
  signUp$: Stream<boolean>
  get: (table: string) => MemoryStream<IGunChain<any, any, any, any>>
}

interface UserSignIn {
  username: string
  password: string
}

interface Get {
  table: string
}

interface Set {
  table: IGunChain<any, any, any, any>
  id?: string
  data: any
}

export type Request = "make-user" | "sign-in" | "sign-out" | "get" | "set" | "put"
type Payload = UserSignIn | Get | Set | null | undefined
export interface GunSink {
  action: Request
  payload: Payload
}

const isMakeUser = (sink: GunSink, payload: Payload): payload is UserSignIn => sink.action === "make-user"
const isSignIn = (sink: GunSink, payload: Payload): payload is UserSignIn => sink.action === "sign-in"
const isSet = (sink: GunSink, payload: Payload): payload is Set => sink.action === "set"
const isPut = (sink: GunSink, payload: Payload): payload is Set => sink.action === "put"

const isError = compose(not, isNil, prop("err"));
const defaultPeers = ['https://gun-manhattan.herokuapp.com/gun'];
export const makeGunDriver = (peers: string[] = defaultPeers) => (stream$: Stream<GunSink>): GunSource => {
  const gun = new Gun({ peers });
  const user = gun.user();
  user.recall({ sessionStorage: true }) // remember me token
  const user$ = adapt(createWithMemory<IGunUserInstance>().startWith(user))
  const error$ = adapt(createWithMemory<string>())
  const signUp$ = adapt(createWithMemory<boolean>())

  gun.on("auth", (_) => {
    user$.shamefullySendNext(user)
    error$.shamefullySendNext("")
  });

  stream$.addListener({
    next: sink => {
      if (isMakeUser(sink, sink.payload)) {
        user.create(sink.payload.username, sink.payload.password, ifElse(
          isError,
          (error: Record<string, any>) => error$.shamefullySendNext(error.err),
          () => signUp$.shamefullySendNext(true)
        ));
      }

      if (isSignIn(sink, sink.payload)) {
        user.auth(sink.payload.username, sink.payload.password, ifElse(
          isError,
          (error: Record<string, any>) => error$.shamefullySendNext(error.err),
          noop
        ));
      }

      if (sink.action === "sign-out") {
        user.leave();
        user$.shamefullySendNext(user);
      }

      if (isSet(sink, sink.payload)) {
        sink.payload.table.set(sink.payload.data);
      }

      if (isPut(sink, sink.payload)) {
        if (sink.payload.id) sink.payload.table.get(sink.payload.id).put(sink.payload.data)
      }
    }
  });

  return {
    user$,
    error$,
    signUp$,
    get: (table: string) => just(user.get(table))
  }
}