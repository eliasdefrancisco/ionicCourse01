import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, of } from 'rxjs';
import { take, map, tap, delay, switchMap } from 'rxjs/operators';

import { Place } from './place.model';
import { AuthService } from '../auth/auth.service';
import { PlaceLocation } from './location.model';

interface PlaceData {
  availableFrom: string;
  availableTo: string;
  description: string;
  imageUrl: string;
  price: number;
  title: string;
  userId: string;
  location: PlaceLocation;
}

@Injectable({
  providedIn: 'root'
})
export class PlacesService {
  private _places = new BehaviorSubject<Place[]>([]);

  get places() {
    return this._places.asObservable();
  }

  // [
  //   new Place(
  //     'p1',
  //     'Manhattan Mansion',
  //     'In the heart of New York City.',
  //     'https://imgs.6sqft.com/wp-content/uploads/2014/06/21042533/Carnegie-Mansion-nyc.jpg',
  //     149.99,
  //     new Date('2019-01-01'),
  //     new Date('2019-12-31'),
  //     'abc'
  //   ),
  //   new Place(
  //     'p2',
  //     'L\'Amour Toujours',
  //     'A romantic place in Paris!',
  //     'https://myldrwithafrenchman.files.wordpress.com/2017/01/eiffel_tower_in_paris__france_073036_.jpg?w=1118',
  //     189.99,
  //     new Date('2019-01-01'),
  //     new Date('2019-12-31'),
  //     'abc'
  //   ),
  //   new Place(
  //     'p3',
  //     'The Foggy Palace',
  //     'Not your average city trip!',
  //     'https://i1.trekearth.com/photos/138102/dsc_0681.jpg',
  //     99.99,
  //     new Date('2019-01-01'),
  //     new Date('2019-12-31'),
  //     'abc'
  //   )
  // ]

  constructor(private authService: AuthService, private http: HttpClient) { }

  fetchPlaces() {
    return this.http
    .get<{[key: string]: PlaceData}>('https://backend-stuff.firebaseio.com/offered-places.json')
    .pipe(
      map(resData => {
        const places = [];
        for (const key in resData) {
          if (resData.hasOwnProperty(key)) {
            places.push(new Place(
              key,
              resData[key].title,
              resData[key].description,
              resData[key].imageUrl,
              resData[key].price,
              new Date(resData[key].availableFrom),
              new Date(resData[key].availableTo),
              resData[key].userId,
              resData[key].location
            ));
          }
        }
        return places;
      }),
      tap(places => {
        this._places.next(places);
      })
    );
  }

  getPlace(id: string) {
    return this.http.get<PlaceData>(
      `https://backend-stuff.firebaseio.com/offered-places/${id}.json`
    ).pipe(
      map(placeData => {
        return new Place(
          id,
          placeData.title,
          placeData.description,
          placeData.imageUrl,
          placeData.price,
          new Date(placeData.availableFrom),
          new Date(placeData.availableTo),
          placeData.userId,
          placeData.location
        );
      })
    );
  }

  uploadImage(image: File) {
    const uploadData = new FormData();
    uploadData.append('image', image);
    return this.http.post<{imageUrl: string, imagePath: string}>(
      'https://us-central1-backend-stuff.cloudfunctions.net/storeImage',
      uploadData
    );
  }

  addPlace(
    title: string,
    description: string,
    price: number,
    dateFrom: Date,
    dateTo: Date,
    location: PlaceLocation,
    imageUrl: string
  ) {
    let generatedId: string;
    let newPlace: Place;
    return this.authService.userId.pipe(
      switchMap(userId => {
        if (!userId) {
          throw new Error('No user found!');
        }
        newPlace = new Place(
          Math.random().toString(),
          title,
          description,
          imageUrl,
          price,
          dateFrom,
          dateTo,
          userId,
          location
        );
        return this.http.post<{name: string}>(
          'https://backend-stuff.firebaseio.com/offered-places.json',
          { ...newPlace, id: null}
        );
      }),
      switchMap(resData => {
        generatedId = resData.name;
        return this.places;
      }),
      take(1),
      tap(places => {
        newPlace.id = generatedId;
        this._places.next(places.concat(newPlace));
      })
    );
  }

  updatePlace(
    placeId: string,
    title: string,
    description: string,
    price: number,
    imageUrl: string
  ) {
    let updatedPlaces: Place[];
    return this.places.pipe(
      take(1),
      switchMap(places => {
        if (!places || places.length <= 0) {
          return this.fetchPlaces();
        } else {
          return of(places);
        }
      }),
      switchMap(places => {
        const updatedPlaceIndex = places.findIndex(pl => pl.id === placeId);
        updatedPlaces = [...places];
        const oldPlace = updatedPlaces[updatedPlaceIndex];
        updatedPlaces[updatedPlaceIndex] = new Place(
          oldPlace.id,
          title,
          description,
          imageUrl,
          price,
          oldPlace.availableFrom,
          oldPlace.availableTo,
          oldPlace.userId,
          oldPlace.location
        );
        return this.http.put(
          `https://backend-stuff.firebaseio.com/offered-places/${placeId}.json`,
          { ...updatedPlaces[updatedPlaceIndex], id: null }
        );
      }),
      tap(() => {
        this._places.next(updatedPlaces);
      })
    );
  }
}
